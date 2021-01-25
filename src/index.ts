import * as k8s from "@kubernetes/client-node"
import * as config from "./config"
import publicIp from 'public-ip';
import { AliDnsUtils } from "./alidns"
import { AliDNSAccount } from "./types";
import { logger } from "./logs"

let kc = new k8s.KubeConfig()
if (config.kubeConfig)
    kc.loadFromFile(config.kubeConfig)
else
    kc.loadFromCluster()

let watch = new k8s.Watch(kc)
const accounts: Map<string, AliDnsUtils> = new Map()

function watchIngress() {
    logger.info('Start Watch Ingress')
    watch.watch('/apis/networking.k8s.io/v1/ingresses', {},
        async (type, ingress: k8s.NetworkingV1beta1Ingress, _watchObj) => {
            if (ingress == null) return;
            if (ingress.metadata!.annotations!['xzzpig.com/alidns'] == 'false') return;
            if (!ingress?.spec?.tls) return;
            let ip = await publicIp.v4()
            for (let tls of ingress.spec.tls) {
                if (!tls.hosts) continue;
                for (let host of tls.hosts) {
                    let dnsUtils = await getDnsUtils(host)
                    if (!dnsUtils) continue;
                    let recordMap = await dnsUtils.getMapedRecord()
                    let rr = host.replace("." + dnsUtils.account.domainName, "");
                    if (type === "ADDED" || type === "MODIFIED") {
                        await setIngressRecord(dnsUtils, recordMap, rr, ip);
                    } else if (type === 'DELETED' && config.autoDeleteRecord) {
                        await deleteIngressRecord(dnsUtils, recordMap, rr);
                    }
                }
            }
        },
        () => {
            logger.warn("Ingress watch is stoped");
            watchIngress()
        },
        (err) => {
            logger.error(err);
            logger.warn("Ingress watch has error");
        })
        .then((_) => { });
}

function watchAccount() {
    logger.info('Start Watch AliDnsAccount')
    watch.watch('/apis/xzzpig.com/v1/alidnsaccount', {
    },
        async (type, account, _watchObj) => {
            if (account == null) return;
            let dnsAccount: AliDNSAccount = {
                name: account?.metadata?.name,
                accessKeyId: account?.spec?.accessKeyId,
                accessKeySecret: account?.spec?.accessKeySecret,
                domainName: account?.spec?.domainName,
            }
            if (!dnsAccount.name) return;
            if (!dnsAccount.accessKeyId) return logger.warn(`AliDnsAccount ${dnsAccount.name} accessKeyId is null`);
            if (!dnsAccount.accessKeySecret) return logger.warn(`AliDnsAccount ${dnsAccount.name} accessKeySecret is null`);;
            if (!dnsAccount.domainName) return logger.warn(`AliDnsAccount ${dnsAccount.name} domainName is null`);;
            if (type === "ADDED" || type === "MODIFIED") {
                accounts.set(dnsAccount.name, new AliDnsUtils(dnsAccount as any));
            } else if (type === "DELETED") {
                accounts.delete(dnsAccount.name)
            }
            logger.info(`${type} AliDnsAccount:${dnsAccount.name}(${dnsAccount.domainName})`)
            updateAllIngressRecord(await publicIp.v4())
        },
        () => {
            logger.warn("AliDnsAccount watch is stoped");
            watchAccount()
        },
        (err) => {
            logger.error(err);
            logger.warn("AliDnsAccount watch has error");
        })
        .then((_) => { });
}

watchIngress();
watchAccount();

(async () => {
    let ip = await publicIp.v4()
    setInterval(async () => {
        let newIp = await publicIp.v4()
        if (newIp != ip) {
            logger.info(`Ip changed:${ip}->${newIp}`)
            ip = newIp;
            await updateAllIngressRecord(ip)
        }
    }, 60 * 1000)
})();

async function updateAllIngressRecord(ip: string) {
    let api = kc.makeApiClient(k8s.NetworkingV1beta1Api);
    for (let ingress of (await api.listIngressForAllNamespaces()).body.items) {
        if (!ingress?.metadata?.annotations) continue;
        if (ingress.metadata!.annotations!['xzzpig.com/alidns'] == 'false') continue;
        if (!ingress?.spec?.rules) continue;
        for (let rule of ingress.spec.rules) {
            let host = rule.host
            if (!host) continue;
            let dnsUtils = await getDnsUtils(host);
            if (!dnsUtils) continue;
            let recordMap = await dnsUtils.getMapedRecord()
            if (!host.endsWith("." + dnsUtils.account.domainName)) continue;
            let rr = host.replace("." + dnsUtils.account.domainName, "");
            await setIngressRecord(dnsUtils, recordMap, rr, ip);
        }
    }
}

function getDnsUtils(host: string) {
    return new Promise<AliDnsUtils | null>((resolve, reject) => {
        accounts.forEach((util) => {
            let domainName = "." + util.account.domainName
            if (host.endsWith(domainName)) return resolve(util);
        })
        return resolve(null);
    })
}

async function setIngressRecord(dnsUtils: AliDnsUtils, recordMap: Map<string, string>, rr: string, ip: string) {
    logger.debug(`Try Set Ingress Recording:${rr}.${dnsUtils.account.domainName}->${ip} using Account ${dnsUtils.account.name}`);
    let recordId = recordMap.get(rr)
    if (recordId) {
        try {
            await dnsUtils.updateRecord(recordId, rr, ip);
            logger.info(`Record ${rr}.${dnsUtils.account.domainName} updated to ${ip}`)
        } catch (error) {
            let msg = error.message as string
            if (msg.includes("The DNS record already exists")) {
                logger.debug(error.message)
                return;
            }
            logger.error(error.message)
        }
    } else {
        await dnsUtils.createRecord(rr, ip)
        logger.info(`Record ${rr}.${dnsUtils.account.domainName} created as ${ip}`)
    }
}

async function deleteIngressRecord(dnsUtils: AliDnsUtils, recordMap: Map<string, string>, rr: string) {
    let recordId = recordMap.get(rr)
    if (recordId) {
        await dnsUtils.deleteRecord(recordId);
        logger.info(`Record ${rr}.${dnsUtils.account.domainName} deleted`)
    }
}

logger.info("AliDNS-Ingress start")
logger.debug("Start debug")