import { apiStatus } from '../../../lib/util';
import { Router } from 'express';
const Crypto = require('crypto');
const SquareConnect = require('square-connect');


module.exports = ({ config, db }) => {

  let mcApi = Router();

  // Configure Square Connect object
  const defaultClient = SquareConnect.ApiClient.instance;

  defaultClient.basePath = (config.square.env == 'sandbox') ? config.square.sandbox.url : config.square.production.url;

  // Configure OAuth2 access token for authorization: oauth2
  var oauth2 = defaultClient.authentications['oauth2'];

  // Set access token sandbox/production
  oauth2.accessToken = (config.square.env == 'sandbox') ? config.square.sandbox.accessToken : config.square.production.accessToken;

  mcApi.post('/complete', async (req, res) => {

    // 2a. Get the order ID from the request body
    const requestParams = req.body;

    console.log('Square Payment API requestParamas:', requestParams);

    // length of idempotency_key should be less than 45
    const idempotencyKey = Crypto.randomBytes(22).toString('hex');

    // Charge the customer's card
    const paymentsApi = new SquareConnect.PaymentsApi();
    const requestBody = {
      source_id: requestParams.nonce,
      amount_money: {
        amount: requestParams.total, // $1.00 charge
        currency: requestParams.currency
      },
      idempotency_key: idempotencyKey
    };

    console.log('Square Payment API requestParamas:', requestBody);

    try {
      const response = await paymentsApi.createPayment(requestBody);
      console.log(response);
      apiStatus(res, response, 200);
    } catch(error) {
      console.log(error);
      apiStatus(res, error, 500);
    }

  });

  return mcApi
}
