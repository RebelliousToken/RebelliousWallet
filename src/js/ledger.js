import ledger from 'ledgerco';
import EthTx from 'ethereumjs-tx';
import { addHexPrefix, bufferToHex, toBuffer } from 'ethereumjs-util';
import HwWallet from './hwWallet';
import config from '../config';
import { getTransactionFields } from './helpers';

class LedgerWallet extends HwWallet {

  constructor(address, dPath, index, comm) {
    super(address, dPath, index);
    this.ethApp = new ledger.eth(comm);
  }

  signRawTransaction(t) {
    t.v = toBuffer(config.chainId);

    return new Promise((resolve, reject) => {
      this.ethApp
        .signTransaction_async(this.getPath(), t.serialize().toString('hex'))
        .then(result => {
          console.log(result);
          const strTx = getTransactionFields(t);
          const txToSerialize = Object.assign(strTx, {
            v: addHexPrefix(result.v),
            r: addHexPrefix(result.r),
            s: addHexPrefix(result.s)
          });

          const serializedTx = new EthTx(txToSerialize).serialize();
          resolve(serializedTx);
        })
        .catch(err => {
          return reject(Error(err + '. Check to make sure contract data is on'));
        });
    });
  }

  signMessage(msg) {
    const msgHex = Buffer.from(msg).toString('hex');

    return new Promise((resolve, reject) => {
      this.ethApp.signPersonalMessage_async(this.getPath(), msgHex, async (signed, error) => {
        if (error) {
          return reject(this.ethApp.getError(error));
        }

        try {
          const combined = signed.r + signed.s + signed.v;
          resolve(bufferToHex(combined));
        } catch (err) {
          reject(err);
        }
      });
    });
  }

  displayAddress(dPath, index) {
    if (!dPath) {
      dPath = this.dPath;
    }
    if (!index) {
      index = this.index;
    }
    return this.ethApp.getAddress_async(dPath + '/' + index, true, false);
  }
}


export default LedgerWallet;