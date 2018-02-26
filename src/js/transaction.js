import Tx from 'ethereumjs-tx';
import config from '../config';
import PromiEvent from 'web3-core-promievent';

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

  constructor(wallet, web3Instance, contractInstance, ledgerWallet = false) {
    this.wallet = wallet;
    web3 = web3Instance;
    contract = contractInstance;
    this.useLedger = false;
    if (ledgerWallet && ledgerWallet.address) {
      this.ledgerWallet = ledgerWallet;
      this.useLedger = true;
    }
  }

  sign(tx) {
    return new Promise((resolve, reject) => {
      if (this.useLedger) {
        this.ledgerWallet.signRawTransaction(tx).then(signedTransaction => {
          resolve(signedTransaction);
        }).catch(err => {
          reject(err);
        })
      } else {
        tx.sign(new Buffer(this.wallet.privateKey.replace(/^0x/, ''), 'hex'));
        resolve(tx.serialize());
      }
    });
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
        this.getGasLimit(rawTx, 'rebl').then(gasLimit=> {
          rawTx.gasLimit = gasLimit;
          web3.eth.getGasPrice().then(gasPrice => {
            rawTx.gasPrice = gasPrice.toString();
            resolve(rawTx);
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
        this.getGasLimit(rawTx, 'eth').then(gasLimit=> {
          rawTx.gasLimit = gasLimit;
          web3.eth.getGasPrice().then(gasPrice => {
            rawTx.gasPrice = gasPrice.toString();
            resolve(rawTx);
          });
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
          to: contractAddress,
          data: encodedAbi
        };
        this.getGasLimit(rawTx, 'eth').then(gasLimit=> {
          rawTx.gasLimit = gasLimit;

          web3.eth.getGasPrice().then(gasPrice => {
            rawTx.gasPrice = gasPrice.toString();
            resolve(rawTx);
          });
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
    if (!currentNonce || currentNonce < nonce) {
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
    let promiEvent = new PromiEvent();
    let transfer = contract.methods.transfer(address, tokensAmount);
    let encodedAbi = transfer.encodeABI();

    web3.eth.getTransactionCount(this.wallet.address).then(nonce => {
      let rawTx = {
        nonce: web3.utils.numberToHex(Transaction.checkNonce(nonce)),
        from: this.wallet.address,
        gasPrice: web3.utils.numberToHex(web3.utils.toWei(gasPrice.toString(), 'gwei')),
        to: contractAddress,
        data: encodedAbi,
      };


      this.getGasLimit(rawTx, 'rebl').then(gasLimit=> {
        rawTx.gasLimit = web3.utils.numberToHex(gasLimit);
        let tx = new Tx(rawTx);
        this.sign(tx).then(serializedTx => {
          web3.eth.sendSignedTransaction('0x' + serializedTx.toString('hex'))
            .on('transactionHash', (transactionHash) => {
              promiEvent.eventEmitter.emit('transactionHash', transactionHash);
            })
            .on('receipt', (res) => {
              promiEvent.resolve(res);
            })
            .on('error', (err) => {
              promiEvent.reject(err);
            });
        }).catch(err => {
          promiEvent.reject(err);
        });
      })
    }).catch(err => {
      promiEvent.reject(err);
    });
    return promiEvent.eventEmitter;
  }

  /**
   * Sends amount ETH to address
   * @param address
   * @param amount
   * @param gasPrice
   * @returns {Promise}
   */
  sendEther(address, amount, gasPrice = config.defaultGasPrice) {
    let promiEvent = new PromiEvent();
      web3.eth.getTransactionCount(this.wallet.address).then(nonce => {
        let rawTx = {
          nonce: web3.utils.numberToHex(Transaction.checkNonce(nonce)),
          from: this.wallet.address,
          gasPrice: web3.utils.numberToHex(web3.utils.toWei(gasPrice.toString(), 'gwei')),
          to: address,
          value: web3.utils.numberToHex(web3.utils.toWei(amount.toString(), 'ether'))
        };

        this.getGasLimit(rawTx, 'eth').then(gasLimit=> {

          rawTx.gasLimit = web3.utils.numberToHex(gasLimit);
          let tx = new Tx(rawTx);
          this.sign(tx).then(serializedTx => {
            web3.eth.sendSignedTransaction('0x' + serializedTx.toString('hex'))
              .on('transactionHash', (transactionHash) => {
                promiEvent.eventEmitter.emit('transactionHash', transactionHash);
              })
              .on('receipt', (res) => {
                promiEvent.resolve(res);
              })
              .on('error', (e) => {
                promiEvent.reject(e);
              });
          }).catch(err => {
            promiEvent.reject(err);
          });
        }).catch(err => {
          promiEvent.reject(err);
        });
      });
    return promiEvent.eventEmitter;
  }

  /**
   * Calls contract's mint()
   * @param gasPrice
   * @return {Promise}
   */
  mint(gasPrice = config.defaultGasPrice) {
    let promiEvent = new PromiEvent();
    let mint = contract.methods.mint();
    let encodedAbi = mint.encodeABI();

    web3.eth.getTransactionCount(this.wallet.address).then(nonce => {
      let rawTx = {
        nonce: web3.utils.numberToHex(Transaction.checkNonce(nonce)),
        from: this.wallet.address,
        gasPrice: web3.utils.numberToHex(web3.utils.toWei(gasPrice.toString(), 'gwei')),
        to: contractAddress,
        data: encodedAbi
      };
      this.getGasLimit(rawTx, 'mint').then(gasLimit => {
        rawTx.gasLimit = web3.utils.numberToHex(gasLimit);
        let tx = new Tx(rawTx);
        this.sign(tx).then(serializedTx => {
          web3.eth.sendSignedTransaction('0x' + serializedTx.toString('hex'))
            .on('transactionHash', (transactionHash) => {
              promiEvent.eventEmitter.emit('transactionHash', transactionHash);
            })
            .on('receipt', (res) => {
              promiEvent.resolve(res);
            })
            .on('error', (err) => {
              promiEvent.reject(err);
            });
        }).catch(err => {
          promiEvent.reject(err);
        });
      });
    }).catch(err => {
      promiEvent.reject(err);
    });
    return promiEvent.eventEmitter;
  }

  getGasLimit(rawTx, type) {
    return new Promise((resolve, reject) => {
      if (type === 'eth') {
        resolve(config.gasLimitFor['eth']);
      }
      else {
        web3.eth.estimateGas(rawTx).then(gasLimit => {
          if (gasLimit > 0) {
            resolve(gasLimit);
          }
          else {
            resolve(config.gasLimitFor[type]);
          }
        }).catch(err => {
          resolve(config.gasLimitFor[type]);
        });
      }
    });

  }

}

module.exports = Transaction;