let Tx = require('ethereumjs-tx');
let config = require('../config');

let web3;

/**
 * Address of token's contract
 * @type {string}
 */
const contractAddress = config.tokenAddress;

/**
 * Token contract instance
 */
let contract;

class Transaction {

  constructor(wallet, web3Instance, contractInstance) {
    this.wallet = wallet;
    web3 = web3Instance;
    contract = contractInstance;
  }

  estimateFeeForTokens(address, tokensAmount) {
    return new Promise((resolve, reject) => {
      let transfer = contract.methods.transfer(address, web3.utils.toWei(tokensAmount));
      let encodedAbi = transfer.encodeABI();

      web3.eth.getTransactionCount(this.wallet.address).then(nonce => {
        let rawTx = {
          nonce: nonce,
          from: this.wallet.address,
          gasLimit: config.gasLimitFor['rebl'],
          to: contractAddress,
          data: encodedAbi
        };

        web3.eth.getGasPrice().then(gasPrice => {
          rawTx.gasPrice = gasPrice.toString();
          resolve(rawTx);
        });
      }).catch(err => {
        reject(err);
      });
    });
  }

  estimateFeeForEth(address, amount) {
    return new Promise((resolve, reject) => {
      web3.eth.getTransactionCount(this.wallet.address).then(nonce => {
        let rawTx = {
          nonce: nonce,
          from: this.wallet.address,
          gasLimit: config.gasLimitFor['eth'],
          to: address,
          value: web3.utils.toWei(amount, 'ether')
        };

        web3.eth.getGasPrice().then(gasPrice => {
          rawTx.gasPrice = gasPrice.toString();
          resolve(rawTx);
        });
      }).catch(err => {
        reject(err);
      });
    });
  }

  estimateFeeForMint() {
    return new Promise((resolve, reject) => {

      let mint = contract.methods.mint();
      let encodedAbi = mint.encodeABI();

      web3.eth.getTransactionCount(this.wallet.address).then(nonce => {
        let rawTx = {
          nonce: nonce,
          from: this.wallet.address,
          gasLimit: config.gasLimitFor['rebl'],
          to: contractAddress,
          data: encodedAbi
        };

        web3.eth.getGasPrice().then(gasPrice => {
          rawTx.gasPrice = gasPrice.toString();
          resolve(rawTx);
        });
      }).catch(err => {
        reject(err);
      });
    });
  }

  /**
   * Returns current nonce for queued transactions
   * @param nonce
   *
   * @return int
   */
  static checkNonce(nonce) {
    let currentNonce = localStorage.getItem('currentNonce');
    if(!currentNonce || currentNonce < nonce) {
      localStorage.setItem('currentNonce', nonce);
      currentNonce = nonce;
    } else {
      localStorage.setItem('currentNonce', ++currentNonce);
    }
    return currentNonce;
  }

  /**
   * Sends signed transaction to blockchain
   * @param address
   * @param tokensAmount
   * @param gasPrice
   */
  sendTokens(address, tokensAmount, gasPrice = config.defaultGasPrice) {
    return new Promise((resolve, reject) => {
      let transfer = contract.methods.transfer(address, tokensAmount);
      let encodedAbi = transfer.encodeABI();

      web3.eth.getTransactionCount(this.wallet.address).then(nonce => {
        let rawTx = {
          nonce: web3.utils.numberToHex(Transaction.checkNonce(nonce)),
          from: this.wallet.address,
          gasLimit: web3.utils.numberToHex(config.gasLimitFor['rebl']),
          gasPrice: web3.utils.numberToHex(web3.utils.toWei(gasPrice.toString(), 'gwei')),
          to: contractAddress,
          data: encodedAbi
        };
        let tx = new Tx(rawTx);
        tx.sign(new Buffer(this.wallet.privateKey.replace(/^0x/, ''), 'hex'));
        let serializedTx = tx.serialize();
        web3.eth.sendSignedTransaction('0x'+serializedTx.toString('hex'))
          .on('transactionHash', (res) => {
            resolve(res);
          })
          .on('error', (e) => {
            reject(e);
          });
      }).catch(err => {
        reject(err);
      });
    });
  }

  /**
   * Sends amount ETH to address
   * @param address
   * @param amount
   * @param gasPrice
   * @returns {Promise}
   */
  sendEther(address, amount, gasPrice = config.defaultGasPrice) {
    return new Promise((resolve, reject) => {

      web3.eth.getTransactionCount(this.wallet.address).then(nonce => {
        let rawTx = {
          nonce: web3.utils.numberToHex(Transaction.checkNonce(nonce)),
          from: this.wallet.address,
          gasPrice: web3.utils.numberToHex(web3.utils.toWei(gasPrice.toString(), 'gwei')),
          gasLimit: web3.utils.numberToHex(config.gasLimitFor['eth']),
          to: address,
          value: web3.utils.numberToHex(web3.utils.toWei(amount.toString(), 'ether'))
        };
        let tx = new Tx(rawTx);
        tx.sign(new Buffer(this.wallet.privateKey.replace(/^0x/, ''), 'hex'));
        let serializedTx = tx.serialize();
        web3.eth.sendSignedTransaction('0x'+serializedTx.toString('hex'))
          .on('transactionHash', (res) => {
            resolve(res);
          })
          .on('error', (e) => {
            reject(e);
          });
      }).catch(err => {
        reject(err);
      });
    });
  }

  /**
   * Calls contract's mint()
   * @param gasPrice
   * @return {Promise}
   */
  mint(gasPrice = config.defaultGasPrice) {
    return new Promise((resolve, reject) => {
      let mint = contract.methods.mint();
      let encodedAbi = mint.encodeABI();

      web3.eth.getTransactionCount(this.wallet.address).then(nonce => {
        let rawTx = {
          nonce: web3.utils.numberToHex(Transaction.checkNonce(nonce)),
          from: this.wallet.address,
          gasPrice: web3.utils.numberToHex(web3.utils.toWei(gasPrice.toString(), 'gwei')),
          gasLimit: web3.utils.numberToHex(config.gasLimitFor['mint']),
          to: contractAddress,
          data: encodedAbi
        };
        let tx = new Tx(rawTx);
        tx.sign(new Buffer(this.wallet.privateKey.replace(/^0x/, ''), 'hex'));

        let serializedTx = tx.serialize();
        web3.eth.sendSignedTransaction('0x'+serializedTx.toString('hex'))
          .on('transactionHash', (res) => {
            resolve(res);
          })
          .on('error', (e) => {
            reject(e);
          });
      }).catch(err => {
        reject(err);
      });
    });
  }
}

module.exports = Transaction;