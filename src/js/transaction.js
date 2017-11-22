let Tx = require('ethereumjs-tx');
let Web3 = require('web3');
let config = require('../config');
let web3 = new Web3(new Web3.providers.HttpProvider(config.networkProvider));

/**
 * Address of token's contract
 * @type {string}
 */
const contractAddress = config.tokenAddress;

/**
 * Interface of token's contract
 * @type {[]}
 */
const abi = config.tokenAbi;

/**
 * Token contract instance
 */
let contract = new web3.eth.Contract(abi, contractAddress);

class Transaction {

  constructor(wallet) {
    this.wallet = wallet;
  }

  estimateFeeForTokens(address, tokensAmount) {
    return new Promise((resolve, reject) => {
      let transfer = contract.methods.transfer(address, web3.utils.toWei(tokensAmount));
      let encodedAbi = transfer.encodeABI();

      web3.eth.getTransactionCount(this.wallet.address).then(nonce => {
        let rawTx = {
          nonce: nonce,
          from: this.wallet.address,
          to: contractAddress,
          data: encodedAbi
        };

        web3.eth.getGasPrice().then(gasPrice => {
          rawTx.gasPrice = web3.utils.numberToHex(web3.utils.toWei(config.gasPrice, 'gwei'));
          web3.eth.getBlock('latest').then(block => {
            rawTx.gasLimit = block.gasLimit;
            web3.eth.estimateGas(rawTx).then(gas => {
              rawTx.gas = gas;
              resolve(rawTx);
            });
          });
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
          to: address,
          value: web3.utils.toWei(amount, 'ether')
        };

        web3.eth.getGasPrice().then(gasPrice => {
          rawTx.gasPrice = web3.utils.numberToHex(web3.utils.toWei(config.gasPrice, 'gwei'));
          web3.eth.getBlock('latest').then(block => {
            rawTx.gasLimit = block.gasLimit;
            web3.eth.estimateGas(rawTx).then(gas => {
              rawTx.gas = gas;
              resolve(rawTx);
            });
          });
        });
      }).catch(err => {
        reject(err);
      });
    });
  }

  static getRandomInt(min, max) {
    return Math.floor(Math.random() * (max - min)) + min;
  }

  /**
   * Sends signed transaction to blockchain
   * @param address
   * @param tokensAmount
   */
  sendTokens(address, tokensAmount) {
    return new Promise((resolve, reject) => {
      let transfer = contract.methods.transfer(address, tokensAmount);
      let encodedAbi = transfer.encodeABI();

      web3.eth.getTransactionCount(this.wallet.address).then(nonce => {
        let rawTx = {
          nonce: nonce,
          from: this.wallet.address,
          to: contractAddress,
          data: encodedAbi
        };

        web3.eth.getGasPrice().then(gasPrice => {
          rawTx.gasPrice = web3.utils.numberToHex(web3.utils.toWei(config.gasPrice, 'gwei'));
          web3.eth.getBlock('latest').then(block => {
            rawTx.gasLimit = block.gasLimit;
            web3.eth.estimateGas(rawTx).then(gas => {
              rawTx.gas = gas;
              let tx = new Tx(rawTx);
              tx.sign(new Buffer(this.wallet.privateKey.replace(/^0x/, ''), 'hex'));

              let serializedTx = tx.serialize();
              web3.eth.sendSignedTransaction('0x'+serializedTx.toString('hex'))
                .on('receipt', (res) => {
                  resolve(res);
                })
                .on('error', (e) => {
                  reject(e);
                });
            });
          });
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
   * @returns {Promise}
   */
  sendEther(address, amount) {
    return new Promise((resolve, reject) => {

      web3.eth.getTransactionCount(this.wallet.address).then(nonce => {
        let rawTx = {
          nonce: nonce,
          from: this.wallet.address,
          to: address,
          value: web3.utils.toWei(amount, 'ether')
        };

        web3.eth.getGasPrice().then(gasPrice => {
          rawTx.gasPrice = web3.utils.numberToHex(web3.utils.toWei(config.gasPrice, 'gwei'));
          web3.eth.getBlock('latest').then(block => {
            rawTx.gasLimit = block.gasLimit;
            web3.eth.estimateGas(rawTx).then(gas => {
              rawTx.gas = gas;
              let tx = new Tx(rawTx);
              tx.sign(new Buffer(this.wallet.privateKey.replace(/^0x/, ''), 'hex'));

              let serializedTx = tx.serialize();
              web3.eth.sendSignedTransaction('0x'+serializedTx.toString('hex'))
                .on('receipt', (res) => {
                  resolve(res);
                })
                .on('error', (e) => {
                  reject(e);
                });
            });
          });
        });
      }).catch(err => {
        reject(err);
      });
    });
  }

  mint() {
    return new Promise((resolve, reject) => {
      let mint = contract.methods.mint();
      let encodedAbi = mint.encodeABI();

      web3.eth.getTransactionCount(this.wallet.address).then(nonce => {
        let rawTx = {
          nonce: nonce,
          from: this.wallet.address,
          to: contractAddress,
          data: encodedAbi
        };

        web3.eth.getGasPrice().then(gasPrice => {
          rawTx.gasPrice = gasPrice;
          web3.eth.getBlock('latest').then(block => {
            rawTx.gasLimit = block.gasLimit;
            web3.eth.estimateGas(rawTx).then(gas => {
              rawTx.gas = gas;
              let tx = new Tx(rawTx);
              tx.sign(new Buffer(this.wallet.privateKey.replace(/^0x/, ''), 'hex'));

              let serializedTx = tx.serialize();
              web3.eth.sendSignedTransaction('0x'+serializedTx.toString('hex'))
                .on('receipt', (res) => {
                  resolve(res);
                })
                .on('error', (e) => {
                  reject(e);
                });
            });
          });
        });
      }).catch(err => {
        reject(err);
      });
    });
  }
}

module.exports = Transaction;