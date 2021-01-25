import * as config from "./config"
import Alidns20150109, * as $Alidns20150109 from '@alicloud/alidns20150109';
import * as $OpenApi from '@alicloud/openapi-client';
import Core from '@alicloud/pop-core';
import { AliDNSAccount } from "./types"

function createClient(accessKeyId: string, accessKeySecret: string): Alidns20150109 {
    let config = new $OpenApi.Config({});
    // 您的AccessKey ID
    config.accessKeyId = accessKeyId;
    // 您的AccessKey Secret
    config.accessKeySecret = accessKeySecret;
    // 访问的域名
    config.endpoint = "dns.aliyuncs.com";
    return new Alidns20150109(config);
}

export class AliDnsUtils {
    account: Required<AliDNSAccount>
    client: Core;
    adClient: Alidns20150109

    constructor(account: Required<AliDNSAccount>) {
        this.account = account;
        this.client = new Core({
            accessKeyId: account.accessKeyId,
            accessKeySecret: account.accessKeySecret,
            endpoint: "https://" + config.endpoint,
            apiVersion: '2015-01-09'
        });
        this.adClient = createClient(account.accessKeyId, account.accessKeySecret);
    }

    async getRecordCount(): Promise<number> {
        let result: any = await this.client.request('DescribeDomainRecords', {
            "DomainName": this.account.domainName,
            "PageSize": 1
        }, {
            method: 'GET'
        })
        return result.TotalCount;
    }

    async getMapedRecord() {
        let result: any = await this.client.request('DescribeDomainRecords', {
            "DomainName": this.account.domainName,
            "PageSize": await this.getRecordCount()
        }, {
            method: 'GET'
        })
        let records = new Map<string, string>();
        for (let record of result.DomainRecords.Record as [{ RR: string, RecordId: string }]) {
            records.set(record.RR, record.RecordId);
        }
        return records;
    }

    async updateRecord(recordId: string, rr: string, value: string, type: string = 'A') {
        await this.adClient.updateDomainRecord(new $Alidns20150109.UpdateDomainRecordRequest({
            recordId,
            RR: rr,
            type,
            value,
        }));
    }

    async createRecord(rr: string, value: string, type: string = 'A') {
        await this.adClient.addDomainRecord(new $Alidns20150109.AddDomainRecordRequest({
            domainName: this.account.domainName,
            RR: rr,
            type,
            value,
        }));
    }

    async deleteRecord(recordId: string) {
        await this.adClient.deleteDomainRecord(new $Alidns20150109.DeleteDomainRecordRequest({
            recordId: recordId,
        }));
    }
}

