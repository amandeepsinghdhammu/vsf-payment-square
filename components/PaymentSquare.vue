<template>
  <div id="sq-ccbox" class="mb15 mt20 vsf-square-container">
    <h4 class="mt0">
      Credit Card
    </h4>
    <div class="bg-cl-secondary px20 py20">
      <div id="payment-form">
        <div id="sq-card-number" />
        <div class="third">
          <div id="sq-postal-code" />
        </div>
        <div class="third">
          <div id="sq-expiration-date" />
        </div>
        <div class="third">
          <div id="sq-cvv" />
        </div>
        <!-- Used to display Element errors. -->
        <div id="vsf-square-card-errors" role="alert">
          &nbsp;
        </div>
      </div> <!-- end #payment-form -->
    </div>
  </div>
</template>

<script>
import { mapState } from 'vuex'
import i18n from '@vue-storefront/i18n'
import config from 'config'
import store from '@vue-storefront/core/store'
import { currentStoreView } from '@vue-storefront/core/lib/multistore'

export default {
  name: 'PaymentSquare',
  data () {
    const storeView = currentStoreView()
    return {
      currencyCode: storeView.i18n.currencyCode,
      square: {
        instance: null,
        elements: null,
        card: null
      }
    }
  },
  computed: mapState({
    squareConfig: state => state.config.square,
    grandTotal () {
      let cartTotals = store.getters['cart/getTotals']
      return cartTotals.find(seg => seg.code === 'grand_total').value
    }
  }),
  beforeMount () {
    this.$bus.$on('order-after-placed', this.onAfterPlaceOrder)
  },
  beforeDestroy () {
    this.$bus.$off('order-after-placed', this.onAfterPlaceOrder)
  },
  mounted () {
    console.log('In Mounted');
    // Load the square payment gateway script.
    this.loadSquareDependencies(this.configureSquare)

    // Ready to place order, handle anything we need to, generating, validating stripe requests & tokens ect.
    this.$bus.$on('checkout-before-placeOrder', this.onBeforePlaceOrder)

    // Ready to place order, handle anything we need to, generating, validating stripe requests & tokens ect.
    this.$bus.$on('checkout-payment-method-changed', (paymentMethodCode) => {
      if (paymentMethodCode !== 'square') {
        // unregister the extension placeorder handler
        this.$bus.$off('checkout-before-placeOrder', this.onBeforePlaceOrder)
      }
    })
  },
  methods: {
    requestCardNonce: function () {
      // Don't submit the form until SqPaymentForm returns with a nonce
      this.$bus.$emit('notification-progress-start', i18n.t('Dont refresh. Completing Payment...'))

      // Request a nonce from the SqPaymentForm object
      this.square.instance.requestCardNonce();
    },
    onAfterPlaceOrder () {
      // Stop display loader
      this.$bus.$emit('notification-progress-stop')
    },
    onBeforePlaceOrder () {
      // this.processSquareForm()
      this.requestCardNonce();
    },
    loadSquareDependencies (callback) {
      const squareJsUrl = (this.squareConfig.env == 'sandbox') ? this.squareConfig.sandbox.sdkUrl : this.squareConfig.production.sdkUrl
      let docHead = document.getElementsByTagName('head')[0]
      var docScript = document.createElement('script')
      docScript.type = 'text/javascript'
      docScript.src = squareJsUrl

      // When script is ready fire our callback.
      docScript.onreadystatechange = callback
      docScript.onload = callback
      docHead.appendChild(docScript)
    },
    configureSquare () {
      let self = this

      this.square.instance = new SqPaymentForm({
        autoBuild: false,
        applicationId: (this.squareConfig.env == 'sandbox') ? this.squareConfig.sandbox.applicationId : this.squareConfig.production.applicationId,
        locationId: (this.squareConfig.env == 'sandbox') ? this.squareConfig.sandbox.locationId : this.squareConfig.production.locationId,
        inputClass: 'sq-input',
        // InitiCVValize the payment form elements
        // Customize the CSS for SqPaymentForm iframe elements
        inputStyles: [{
          fontSize: '16px',
          lineHeight: '24px',
          padding: '16px',
          placeholderColor: '#a0a0a0',
          backgroundColor: 'transparent'
        }],
        // Initialize the credit card placeholders
        cardNumber: {
          elementId: 'sq-card-number',
          placeholder: 'Card Number'
        },
        cvv: {
          elementId: 'sq-cvv',
          placeholder: 'Security Code'
        },
        expirationDate: {
          elementId: 'sq-expiration-date',
          placeholder: 'MM/YY'
        },
        postalCode: {
          elementId: 'sq-postal-code',
          placeholder: 'Postal Code'
        },
        // SqPaymentForm callback functions
        callbacks: {
          /*
             * Digital Wallet related functions
             */
          createPaymentRequest: function () {
            var paymentRequestJson;
            /* ADD CODE TO SET/CREATE paymentRequestJson */
            return paymentRequestJson;
          },
          validateShippingContact: function (contact) {
            var validationErrorObj;
            /* ADD CODE TO SET validationErrorObj IF ERRORS ARE FOUND */
            return validationErrorObj;
          },
          /*
             * callback function: cardNonceResponseReceived
             * Triggered when: SqPaymentForm completes a card nonce request
             */
          cardNonceResponseReceived: function (errors, nonce, cardData) {
            console.log('nonce:', nonce)
            console.log('cardData:', cardData)
            console.log('Errors:', errors)
            if (errors) {
              errors.forEach((error) => {
                alert(error.message);
              });
              this.$bus.$emit('notification-progress-stop');
              return;
            }

            self.completePayment(nonce);
          },
          /*
		   * callback function: paymentFormLoaded
		   * Triggered when: SqPaymentForm is fully loaded
		   */
          paymentFormLoaded: function () {
            self.square.instance.focus('cardNumber');
            console.log('paymentFormLoaded');
            /* HANDLE AS DESIRED */
          }
        }
      });

      this.square.instance.build();

    },
    getTransactions () {
      return {amount: {total: this.grandTotal, currency: this.currencyCode}}
    },
    async completePayment (nonce) {
      let baseUrl = config.api.url;
      let url = baseUrl + this.squareConfig.endpoint.complete
      url = config.storeViews.multistore ? adjustMultistoreApiUrl(url) : url
      let completed = await fetch(url, {
        method: 'POST',
        mode: 'cors',
        headers: {
          'Accept': 'application/json, text/plain, */*',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          nonce: nonce,
          total: this.getTransactions().amount.total * 100,
          currency: this.getTransactions().amount.currency
        })
      }).then(resp => { return resp.json() })

      if (completed.code == 200) {
        this.placeOrderWithPayload(completed.result)
        console.log('Payment complete successfully!\nCheck browser developer console for more details')
      } else {
        let errorElement = document.getElementById('vsf-square-card-errors')
        errorElement.textContent = completed.result.error.message
        console.log('Payment failed to complete!\nCheck browser developer console for more details')
      }
      this.$bus.$emit('notification-progress-stop');

    },
    placeOrderWithPayload (payload) {
      this.$bus.$emit('checkout-do-placeOrder', payload)
    }
  }
}
</script>

<style>
#sq-ccbox {
  border: 1px solid;
  margin-top: 20px;
}
#sq-ccbox h4{
  padding: 20px 0 0 20px;
}
#form-container {
  position: relative;
  margin: 0 auto;
}

.third {
  float: left;
  width: calc((100% - 32px) / 3);
  padding: 0;
  margin: 0 16px 16px 0;
}

.third:last-of-type {
  margin-right: 0;
}

/* Define how SqPaymentForm iframes should look */
.sq-input {
  height: 56px;
  box-sizing: border-box;
  border: 1px solid #E0E2E3;
  background-color: white;
  border-radius: 6px;
  display: inline-block;
  -webkit-transition: border-color .2s ease-in-out;
     -moz-transition: border-color .2s ease-in-out;
      -ms-transition: border-color .2s ease-in-out;
          transition: border-color .2s ease-in-out;
}

/* Define how SqPaymentForm iframes should look when they have focus */
.sq-input--focus {
  border: 1px solid #9d2b8a;
}

/* Define how SqPaymentForm iframes should look when they contain invalid values */
.sq-input--error {
  border: 1px solid #E02F2F;
}

#sq-card-number {
  margin-bottom: 16px;
}

/* Customize the "Pay with Credit Card" button */
.button-credit-card {
  box-shadow:
    0px 2px 8px rgba(0, 0, 0, 0.08),
    0px 1px 3px rgba(0, 0, 0, 0.04);
  height: auto;
  font-size: 16px;
  letter-spacing: 0.5px;
  line-height: 24px;
  margin-top: 16px;
  padding: 16px;
  position: relative;
  text-transform: uppercase;
  width: 100%;
  z-index: 1;
  background: linear-gradient(180deg,#9d2b8a -57.14%,#fb2f74 125%);
  border: none;
  color: #fff;
}

.button-credit-card:hover {
  background: linear-gradient(180deg,#9d2b8a -57.14%,#fb2f74 125%);
  color: #fff;
}
</style>
