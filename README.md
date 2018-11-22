Token splitter secures frontend applications that call oAuth protected (eg: using WSO2 APIM) APIs by preventing XSS token theft and CSRF.


Setting up with WSO2 AM
=======================

1. Create an application in wso2am and obtain client id and client secret. And pass via to `TS_CLIENT_ID` and `TS_CLIENT_SECRET` env variables.
2. Set `TS_API_BACKEND_URI` and `TS_TOKEN_URI` values to AM token endpoint and AM url. (defalts work if AM is running in localhost with default port, see `env-var-defaults.json`).
3. (Opt) Run following curl with a valid user name and a password to test token gen
   ```sh
   curl -X POST localhost:3000/api/login -v -d "grant_type=password&scope=openid&username=tom&password=tompass" -c /tmp/cookie.txt
   ```
