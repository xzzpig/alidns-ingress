import * as process from "process"

export const endpoint = process.env['ENDPOINT'] ?? "dns.aliyuncs.com"

export const autoDeleteRecord = (process.env['AUTO_DELETE_RECORD'] ?? "false") == 'true'
export const kubeConfig = process.env['KUBE_CONFIG'] 

export const logLevel = process.env['ALIDNS_LOG_LEVEL'] ?? "info"
