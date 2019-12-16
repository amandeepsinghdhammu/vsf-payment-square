# Square Payment Gateway extension

This API extension charge the Payment Source Using the Nonce.

in your `local.json` file you should register the extension:
`"registeredExtensions": ["mailchimp-subscribe", "example-magento-api", "cms-data", "square"],`

The API endpoitns are:
```
/api/ext/complete
```

Dependencies

```
crypto
squareConnect
```
`npm install crypto`
`npm install squareConnect`


Add the following also to your config/local.json and configure the square credentials
```
"square": {
  "env" : "sandbox",
  "sandbox": {
    "accessToken": "xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx",
    "url": "https://connect.squareupsandbox.com"
  },
  "production": {
    "accessToken": "xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx",
    "url": "https://connect.squareup.com"
  }
}
```
