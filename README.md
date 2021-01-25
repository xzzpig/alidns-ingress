# alidns-ingress
A k8s app to auto update alidns from ingress

## Install
### Install with Helm
```shell
$ git clone --depth=1 https://github.com/xzzpig/alidns-ingress.git 
$ cd alidns-ingress
$ helm install alidns-ingress ./charts/alidns-ingress/
```

### Install manually
```bash
$ kubectl apply -f https://github.com/xzzpig/alidns-ingress/raw/main/deploy/bundle.yaml
```


# Cookbook
1. Create AliDnsAccount
```yaml
apiVersion: xzzpig.com/v1
kind: AliDnsAccount
metadata:
  name: example-account
spec:
  accessKeyId: YourKeyIdHere
  accessKeySecret: YourKeySecretHere
  domainName: yourdomain.com
```

2. Create/Modify Ingress
```yaml
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: example
spec:
  rules:
  - host: example.yourdomain.com
    http:
      paths:
      - backend:
          service:
            name: example
            port:
              number: 5000
        path: /
        pathType: Prefix
```
3. Enjoy!
> This app will auto match AliDnsAccount by Ingress.spec.rules.host and modify alidns record(`example`) to clusters public ip

## Environments
| name | describe | default |
|--|--|--|
| ENDPOINT | aliyun dns endpoint | dns.aliyuncs.com |
| AUTO_DELETE_RECORD | will auto delete dns record when ingress is deleted | false |
| ALIDNS_LOG_LEVEL | app log level | info |
