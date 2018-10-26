const {shell} = require('electron');
const {dialog} = require('electron').remote;
let fs = require('fs');
let config = require('./config');
let Transaction = require('./js/transaction');
let Web3 = require('web3');
let log = require('electron-log');
let toastr = require('toastr');
let ledger = require('ledgerco');
let trezor = require('./js/trezor-connect');
import trezorConnect from './js/trezor-connect';
import LedgerWallet from './js/ledger.js';
import {TrezorWallet, TREZOR_MINIMUM_FIRMWARE} from './js/trezor.js';
import {deriveWallets, deriveTrezorWallets} from './js/helpers';

let currentProvider = 'infura';
let web3 = new Web3(new Web3.providers.HttpProvider(config.networkProvider[currentProvider]));

let myWallet;

let contract = new web3.eth.Contract(config.tokenAbi, config.tokenAddress);
let transaction;

let tokenBalance = 0;
let ethBalance = 0;
let version = "0.0.4";

let reblUSD = 0;
let etherUSD = 0;

let web3ProviderSwitchCount = 1;

let transactionPrices = {
  slowTransactionPrice: 5,
  normalTransactionPrice: 10,
  fastTransactionPrice: 20
};

let ledgerWallet;
let trezorWallet;
let keys;
let trezorKeys;
let ledgerComm;
let trezorComm;

const defaultDecimals = 1000000000000000000;
checkUpdates();

function initLedger() {
  let wallets;
  return new Promise((resolve, reject) => {
    if (!ledgerWallet) {
      ledger.comm_node.create_async().then(comm => {
        let eth = new ledger.eth(comm);
        ledgerComm = comm;
        eth.getAddress_async(config.ledgerPath, false, true).then(res => {
          keys = res;
          wallets = deriveWallets(keys);
          fillWalletsTable(wallets);
          ledgerWallet = 1; // dirty hack
          resolve();
        }).catch(err => {
          reject(err);
          if (err && err.metaData && err.metaData.code === 5) {
            //
          }
        });
      }).catch(() => {
        reject();
      });
    }
  });
}

function initTrezor() {
  let wallets;
  return new Promise((resolve, reject) => {
    if (!trezorWallet) {
      let dPath = config.trezorPath;
      trezorConnect.getXPubKey(
        dPath,
        res => {
          if (res.success) {
            trezorKeys = res;
            wallets = deriveTrezorWallets(res);

            fillTrezorWalletsTable(wallets);

            resolve(res);
          } else {
            reject(res.error)
          }
        },
        TREZOR_MINIMUM_FIRMWARE
      );
    }
  });
}

function UseLedgerNanoS() {
  HideButtons();
  $('#ledgernano').attr('class', '');
}

function UseTrezor() {
  HideButtons();
  $('#trezor').attr('class', '');
}

function ConnectLedgerNanoS() {
  initLedger().then(() => {
    toastr.clear();
    $('#chooseWallet').modal('show');
  }).catch(() => {
    toastr.error('Make sure your Ledger is plugged in, turned on, has "Browser support" disabled and has "Contract data" enabled.');
  });
  if (ledgerWallet) {
    toastr.clear();
    $('#chooseWallet').modal('show');
  }
}

function ConnectTrezor() {
  initTrezor().then(() => {
    toastr.clear();
    $('#chooseTrezorWallet').modal('show');
  }).catch(() => {
    toastr.error('Make sure your TREZOR is plugged in.');
  });
  if (trezorWallet) {
    toastr.clear();
    $('#chooseTrezorWallet').modal('show');
  }
}

function clearToastr() {
  toastr.clear();
}

async function fillBalances(wallets) {
  checkNetwork();
  clearToastr();
  for (let wallet of wallets) {
    let ethBalance = parseFloat(await getEthBalance(wallet.address));
    let reblBalance = await getReblBalance(wallet.address);
    reblBalance = reblBalance.reblValue;
    $('.eth-balance-' + wallet.index).text(ethBalance.toFixed(4));
    $('.rebl-balance-' + wallet.index).text(reblBalance.toFixed(4));
  }
}

function fillWalletsTable(wallets) {
  let walletsTable = $('.wallets-list tbody');
  walletsTable.html();
  let list = '';
  for (let wallet of wallets) {
    list +=
      '<tr>' +
      '<td>' +
      '<input type="radio" class="selected-wallet" id="selected-wallet-' + wallet.address + '" name="selected-wallet" data-address="' + wallet.address + '" value="' + wallet.index + '"><label for="selected-wallet-' + wallet.address + '">' + wallet.address + '</label>' +
      '</td>' +
      '<td class="eth-balance-' + wallet.index + '">-</td>' +
      '<td class="rebl-balance-' + wallet.index + '">-</td>' +
      '</tr>'
  }
  walletsTable.html(list);
  fillBalances(wallets);
}

function fillTrezorWalletsTable(wallets) {
  let walletsTable = $('.trezor-wallets-list tbody');
  walletsTable.html();
  let list = 'trezor list';
  for (let wallet of wallets) {
    list +=
      '<tr>' +
      '<td>' +
      '<input type="radio" class="selected-wallet" id="selected-wallet-' + wallet.address + '" name="selected-wallet" data-address="' + wallet.address + '" value="' + wallet.index + '"><label for="selected-wallet-' + wallet.address + '">' + wallet.address + '</label>' +
      '</td>' +
      '<td class="eth-balance-' + wallet.index + '">-</td>' +
      '<td class="rebl-balance-' + wallet.index + '">-</td>' +
      '</tr>'
  }
  walletsTable.html(list);
  fillBalances(wallets);
}

let keyStoreButton = $('#keystorebtn');
let keyStoreJsonError = $('#keystorejsonerror');
let sendEtherButton = $('#sendethbutton');
let sendReblButton = $('#sendtokenbutton');
let txIdLink = $('.txidLink');
let tokenRecipientAddressField = $('#send_to_token');
let tokensAmountField = $('#send_amount_token');
let ethRecipientAddressField = $('#send_ether_to');
let ethAmountField = $('#send_ether_amount');

toastr.options = {
  "closeButton": true,
  "debug": false,
  "newestOnTop": false,
  "progressBar": false,
  "positionClass": "toast-top-left",
  "preventDuplicates": true,
  "onclick": null,
  "showDuration": "300",
  "hideDuration": "1000",
  "timeOut": "360000",
  "extendedTimeOut": "1000",
  "showEasing": "swing",
  "hideEasing": "linear",
  "showMethod": "fadeIn",
  "hideMethod": "fadeOut"
};

checkNetwork();
updateTransactionPrices();

function checkNetwork() {
  web3.eth.getProtocolVersion().catch(e => {
    handleError(e, {
      'function': checkNetwork,
      'from': 'checkNetwork'
    })
  });
}

function handleError(e, action = false) {
  log.error(e, action['from']);

  if (currentProvider === 'infura' && action['function'] && web3ProviderSwitchCount < 10) {
    currentProvider = 'giveth';
    web3.setProvider(config.networkProvider[currentProvider]);
    contract = new web3.eth.Contract(config.tokenAbi, config.tokenAddress);
    action['args'] = action['args'] ? action['args'] : [];
    web3ProviderSwitchCount++;
    return action['function'](...action['args']);
  }
  else if (currentProvider === 'giveth' && action['function'] && web3ProviderSwitchCount < 10) {
    currentProvider = 'infura';
    web3.setProvider(config.networkProvider[currentProvider]);
    contract = new web3.eth.Contract(config.tokenAbi, config.tokenAddress);
    action['args'] = action['args'] ? action['args'] : [];
    web3ProviderSwitchCount++;
    return action['function'](...action['args']);
  }
  else if (web3ProviderSwitchCount >= 10 && action['function']) {
    toastr.error('Connection error. Please try again later.');
  }
  else if (e == 'Error: Invalid JSON RPC response: ""' || e == "Error: Couldn't decode uint256 from ABI: 0x") {
    toastr.error('Requested API server currently not responding. Please try again later.');
  }
  else if (e == 'Error: Returned error: insufficient funds for gas * price + value null') {
    toastr.error("Your wallet's ETH balance is not enough to cover the gas cost. Please deposit some ETH into your wallet.");
  }
  else if (e == "Error: CONNECTION ERROR: Couldn't connect to node on IPC.") {
    // ignore message
  }
  else if (e == "Error: connection not open") {
    // ignore message
  }
  else if (e == 'TypeError: Failed to fetch null' || e == 'TypeError: Failed to fetch') {
    toastr.error("Collect reward service temporarily down for maintenance. Please try again later.");
  }
  else {
    toastr.error(e);
  }
}

function OpenEtherScan(txid) {
  shell.openExternal('https://etherscan.io/tx/' + txid)
}

function OpenGithubRepo() {
  shell.openExternal('https://github.com/RebelliousToken/RebelliousWallet')
}

function OpenGithubReleases() {
  shell.openExternal('https://github.com/RebelliousToken/RebelliousWallet/releases')
}

function OpenHunterGithub() {
  shell.openExternal('https://github.com/RebelliousToken')
}

function OpenMyEtherWallet() {
  shell.openExternal('https://www.myetherwallet.com')
}

function openLink(link) {
  shell.openExternal(link);
}

function OpenHelpRewardPage() {
  shell.openExternal('https://www.rebellious.io/problems-claiming-your-reward/')
}

function ReblPrice() {
  let api = "https://api.coinmarketcap.com/v1/ticker/rebl/";
  $.get(api, (data, status) => {
    if (status === 'success') {
      reblUSD = parseFloat(data[0]['price_usd']);
    }
  });
}

function EtherPrice() {
  let api = "https://api.coinmarketcap.com/v1/ticker/ethereum/";
  $.get(api, (data, status) => {
    if (status === 'success') {
      etherUSD = parseFloat(data[0]['price_usd']);
    }
  });
}

UpdatePricing();

/*
 * Show actual ETH and REBL USD prices
 */
function UpdatePricing() {
  EtherPrice();
  ReblPrice();
}

function UpdatePortfolio() {
  setTimeout(() => {
    let totalRebl = tokenBalance * reblUSD / defaultDecimals;
    let totalEth = ethBalance * etherUSD;
    let totalPort = totalRebl + totalEth;
    $('#portReblUSD').html("($" + reblUSD.toFixed(2) + ")");
    $('#portEthUSD').html("($" + etherUSD.toFixed(2) + ")");
    $('#portfolioRebl').html(totalRebl.toFixed(2));
    $('#portfolioEth').html(totalEth.toFixed(2));
    $('#portfolioTotal').html(totalPort.toFixed(2));
    $('.portfolio').fadeIn('fast');
  }, 3500);
}

activateValidators();

function CheckForUpdates() {
  let versionFile = "https://github.com/RebelliousToken/RebelliousWallet/blob/master/VERSION";
  $.get(versionFile, (data, status) => {
    let verCheck = data.replace(/^\s+|\s+$/g, '');
    if (version !== verCheck) {
      alert("There's a new Update for Rebellious Wallet! New Version: " + data);
      OpenGithubReleases();
    } else {
      alert("You have the most current version");
    }
  });
}

function CheckETHAvailable() {
  let send = ethAmountField.val();
  let fee = $('#ethtxfee').val();
  let spendable = ethBalance - (send - fee);
  if (spendable >= 0 && !sendEtherButton.prop('disabled')) {
    sendEtherButton.prop('disabled', false);
  } else {
    sendEtherButton.prop('disabled', true);
  }
}

function CheckTokenAvailable() {
  let send = tokensAmountField.val();
  let spendable = tokenBalance - send;
  if (spendable >= 0 && !sendReblButton.prop('disabled')) {
    sendReblButton.prop('disabled', false);
  } else {
    sendReblButton.prop('disabled', true);
  }
}

setInterval(() => {
  if (myWallet) {
    updateBalance();
  }
}, 5000);

setInterval(() => {
  if (myWallet) {
    UpdatePortfolio();
  }
}, 30000);

setInterval(() => {
  if (myWallet) {
    getReward();
  }
}, 1200000);

setInterval(updateTransactionPrices, 60000);

function UseKeystore() {
  HideButtons();
  $('#keystoreupload').attr('class', '');
}

function UsePrivateKey() {
  HideButtons();
  $('#privatekey').attr('class', '');
}

function UseNewWallet() {
  HideButtons();
  $('#createnewwallet').attr('class', '');
}

function CopyAddress() {
  let $temp = $("<input>");
  $("body").append($temp);
  $temp.val(myWallet.address).select();
  document.execCommand("copy");
  $temp.remove();
  toastr.info("Address Copied: " + myWallet.address, '', {timeOut: 5000});
}

function HideButtons() {
  $('#keystoreupload').attr('class', 'hidden');
  $('#createnewwallet').attr('class', 'hidden');
  $('#privatekey').attr('class', 'hidden');
  $('#ledgernano').attr('class', 'hidden');
  $('#trezor').attr('class', 'hidden');
}

function OpenPrivateKey() {
  let key = $("#privatepass").val();
  if (key.substring(0, 2) !== '0x') {
    key = '0x' + key;
  }
  if (key !== '' && key.match(/^(0x)?[0-9A-fa-f]{64}$/)) {
    HideButtons();
    try {
      myWallet = web3.eth.accounts.privateKeyToAccount(key);
      SuccessAccess();
      updateBalance();
      UpdatePortfolio();
    } catch (e) {
      handleError(e, {
        'function': OpenPrivateKey,
        'from': 'OpenPrivateKey'
      });
      $("#privatekeyerror").show();
    }
  } else {
    $("#privatekeyerror").show();
  }
}

function OpenNewWallet() {
  let pass = $('#newpass').val();
  let passconf = $('#newpassconf').val();
}

function getEthBalance(address) {
  return new Promise((resolve, reject) => {
    web3.eth.getBalance(address).then(balance => {
      let etherString = web3.utils.fromWei(balance, 'ether');
      let n = parseFloat(etherString);
      resolve(n);
    }).catch(err => {
      resolve(handleError(err, {
        'function': getEthBalance,
        'from': 'getEthBalance',
        'args': [address]
      }));
    });
  });
}

function getReblBalance(address) {
  return new Promise((resolve, reject) => {
    let getReblBalanceCall = contract.methods.balanceOf(address).call();
    getReblBalanceCall.then(balance => {
      let reblValue = balance * (1 / defaultDecimals);
      resolve({reblValue, balance});
    }).catch(err => {
      resolve(handleError(err, {
        'function': getReblBalance,
        'from': 'getReblBalance',
        'args': [address]
      }));
    });
  });
}

function updateBalance() {
  let address = myWallet.address;
  $('.myaddress').html(address);

  getEthBalance(address).then(n => {
    let ethValue = n.toLocaleString(
      'en-US',
      {
        minimumFractionDigits: 8
      }
    );
    let messageEl = $('#ethbal');
    let split = ethValue.split(".");
    ethBalance = parseFloat(ethValue);
    messageEl.html(split[0] + ".<small>" + split[1] + "</small>");
  }).catch(err => {
    handleError(err, {
      'function': updateBalance,
      'from': 'updateBalance->getEthBalance'
    });
  });

  getReblBalance(address).then(balances => {
    let {reblValue, balance} = balances;
    reblValue = reblValue.toLocaleString(
      'en-US',
      {
        minimumFractionDigits: 8
      }
    );
    let messageEl = $('#reblbal');
    let split = reblValue.split(".");
    tokenBalance = balance;
    $('.reblspend').html(reblValue);
    messageEl.html(split[0] + ".<small>" + split[1] + "</small>");
  }).catch(err => {
    handleError(err, {
      'function': updateBalance,
      'from': 'updateBalance->getReblBalance'
    });
  });

}

let keyFile;
function OpenKeystoreFile() {
  dialog.showOpenDialog(fileNames => {
    if (fileNames === undefined) return;
    keyFile = fileNames[0];
    $('.open-key-store').css({color: '#fff', backgroundColor: 'rgb(0, 171,178)'});
  });
}

function SuccessAccess() {
  localStorage.removeItem('currentNonce');
  transaction = new Transaction(myWallet, web3, contract, ledgerWallet, trezorWallet);
  $('.select-open-method').hide();
  $('.walletInput').hide();
  $('.send-receive-tabs').toggleClass('hidden');
  $('.send-receive-tabs-content').toggleClass('hidden');
  $('#addressArea').attr('class', 'row');
  $('#walletActions').attr('class', 'row');
  $('.about.top').toggle();
  $('.about.bottom').toggle();
  getReward();
}

/**
 * @return {boolean}
 */
function GetEthGas() {
  let to = ethRecipientAddressField.val();
  let amount = ethAmountField.val();
  $('.eth-gas-limit').parent().parent().find('.init-slider').slider('disable');
  if (to.match(/^(0x)?[0-9A-fa-f]{40}$/) && amount !== '') {
    transaction.estimateFeeForEth(to, amount).then(result => {
      let gasPrice = web3.utils.fromWei(result.gasPrice);
      $('.eth-gas-limit').text(result.gasLimit);
      $('.eth-gas-price').text(web3.utils.fromWei(result.gasPrice, 'gwei'));
      $('.eth-estimated-fee').text((result.gasLimit * gasPrice).toFixed(10) + ' ETH');
      $('.eth-gas-limit').parent().parent().find('.init-slider').slider("value", transactionPrices.normalTransactionPrice);
      $('.eth-gas-limit').parent().parent().find('.init-slider').slider('enable');
    }).catch(err => {
      handleError(err, {
        'function': GetEthGas,
        'from': 'GetEthGas'
      });
    });
  }
  return false;
}

/**
 * @return {boolean}
 */
function GetTokenGas() {
  let to = tokenRecipientAddressField.val();
  let amount = tokensAmountField.val();
  $('.rebl-gas-limit').parent().parent().find('.init-slider').slider('disable');
  if (to.match(/^(0x)?[0-9A-fa-f]{40}$/) && amount !== '') {
    transaction.estimateFeeForTokens(to, amount).then(result => {
      let gasPrice = web3.utils.fromWei(result.gasPrice);
      $('.rebl-gas-limit').text(result.gasLimit);
      $('.rebl-gas-price').text(web3.utils.fromWei(result.gasPrice, 'gwei'));
      $('.rebl-estimated-fee').text((result.gasLimit * gasPrice).toFixed(10) + ' ETH');
      $('.rebl-gas-limit').parent().parent().find('.init-slider').slider("value", transactionPrices.normalTransactionPrice);
      $('.rebl-gas-limit').parent().parent().find('.init-slider').slider('enable');
    }).catch(err => {
      handleError(err, {
        'function': GetTokenGas,
        'from': 'GetTokenGas'
      });
    });
  }
  return false;
}

function UnlockWalletKeystore() {
  if (keyFile !== '' && keyFile !== undefined) {
    let password = $('#keystorewalletpass').val();
    let buffer = fs.readFileSync(keyFile);
    let walletData = buffer.toString();
    keyStoreButton.html('Decrypting...');
    keyStoreButton.prop('disabled', true);
    try {
      let JsonData = JSON.parse(walletData.toLowerCase());
      try {
        myWallet = web3.eth.accounts.decrypt(JsonData, password);
        SuccessAccess();
        updateBalance();
        UpdatePortfolio();
        keyStoreButton.html('Decrypting...');

      } catch (e) {
        keyStoreJsonError.html('Incorrect Password for Keystore Wallet');
        keyStoreJsonError.show();
        keyStoreButton.prop('disabled', false);
        keyStoreButton.html('Open');
      }
    } catch (e) {
      keyStoreJsonError.html('Please select correct keystore file');
      keyStoreJsonError.show();
      keyStoreButton.prop('disabled', false);
      keyStoreButton.html('Open');
      log.error(e);
    }
  } else {
    keyStoreJsonError.html('Invalid Keystore JSON File');
    keyStoreJsonError.show();
    keyStoreButton.prop('disabled', false);
    keyStoreButton.html('Open');
  }
}

function reject() {
  keyStoreJsonError.html('Incorrect Password for Keystore Wallet')
  keyStoreJsonError.show();
  keyStoreButton.prop('disabled', false);
  keyStoreButton.html('Open');
}

function ConfirmButton(elem) {
  $(elem).html('CONFIRM');
  $(elem).attr('class', 'btn btn-success')
}

function SendEthereum(gasPrice = config.defaultGasPrice) {
  let to = ethRecipientAddressField.val();
  let amount = ethAmountField.val();

  disableSendEthButton('Please wait');

  if (amount !== '' && parseFloat(amount) <= ethBalance) {
    transaction.sendEther(to, amount, gasPrice)
      .once('transactionHash', (transactionHash) => {
        enableSendEthButton();
        $('#ethermodal').modal('hide');
        txIdLink.html(transactionHash);
        txIdLink.attr('onclick', "OpenEtherScan('" + transactionHash + "')");
        $('#senttxamount').html(amount);
        $('#txtoaddress').html(to);
        $('#txtype').html('ETH');
        $('#trxsentModal').modal('show');
        updateBalance();
        ethRecipientAddressField.val('');
        ethAmountField.val('');
      })
      .then(() => {
        toastr.success('You have successfully sent ' + amount + ' ETH to ' + to);
      })
      .catch(e => {
        handleError(e, {
          'from': 'SendEthereum'
        });
        enableSendEthButton();
      });
  }
}

function UpdateAvailableETH() {
  let fee = $("#ethtxfee").val();
  let available = ethBalance - fee;
  $('.ethspend').html(available.toFixed(6));
}

function UpdateTokenFeeETH() {
  $('.ethavailable').each(function () {
    $(this).html(ethBalance.toFixed(6));
  });
}

function showSend(type) {
  $('div[class*=send-crypto]').addClass('hidden');
  $('.send-' + type + '-wrapper').toggleClass('hidden');
  $('.send-receive-tabs-content').addClass('hidden');
  $('.nav-tabs .active a').addClass('back-send').text('back');
}

function goBack(self) {
  if ($(self).hasClass('back-send')) {
    $('div[class*=send-crypto]').addClass('hidden');
    $('.send-receive-tabs-content').removeClass('hidden');
    $(self).removeClass('back-send').text('send');
  }
  getReward();
}

function restoreSend(self) {
  if ($(self).parent().siblings().find('a').hasClass('back-send')) {
    goBack($(self).parent().siblings().find('a'));
  }
}

function scientificToDecimal(num) {
  //if the number is in scientific notation remove it
  if (/\d+\.?\d*e[\+\-]*\d+/i.test(num)) {
    let zero = '0',
      parts = String(num).toLowerCase().split('e'), //split into coeff and exponent
      e = parts.pop(),//store the exponential part
      l = Math.abs(e), //get the number of zeros
      sign = e / l,
      coeff_array = parts[0].split('.');
    if (sign === -1) {
      num = zero + '.' + new Array(l).join(zero) + coeff_array.join('');
    }
    else {
      let dec = coeff_array[1];
      if (dec) l = l - dec.length;
      num = coeff_array.join('') + new Array(l + 1).join(zero);
    }
  }

  return num;
}

$.validator.addMethod(
  'regex',
  function (value, element, regexp) {
    let re = new RegExp(regexp);
    return this.optional(element) || re.test(value);
  },
  'Address is invalid, please enter a valid address'
);

function activateValidators() {
  let confirmTransactionModal = $('#confirmTransaction');
  $('#send-rebl').on('submit', (e) => {
    e.preventDefault();
    confirmTransactionModal.find('#submit-transaction').off('click');
  }).validate({
    errorPlacement: (error, element) => {
      error.appendTo(element.siblings('.error-placement'));
    },
    rules: {
      send_to_token: {
        required: true,
        regex: '^(0x)?[0-9A-fa-f]{40}$'
      },
      send_amount_token: {
        required: true,
        number: true
      }
    },
    submitHandler: () => {
      confirmTransactionModal.find('.amount-crypto').text(tokensAmountField.val());
      confirmTransactionModal.find('.type-crypto').text('REBL');
      confirmTransactionModal.find('.address-to-send').text(tokenRecipientAddressField.val());
      confirmTransactionModal.modal('show');
      confirmTransactionModal.find('#submit-transaction').on('click', () => {
        SendToken($('#send-rebl').find('.rebl-slider').slider('value'));
        confirmTransactionModal.find('#submit-transaction').off('click');
      });
    }
  });

  $('#send-eth').on('submit', (e) => {
    e.preventDefault();
    confirmTransactionModal.find('#submit-transaction').off('click');
  }).validate({
    errorPlacement: (error, element) => {
      error.appendTo(element.siblings('.error-placement'));
    },
    rules: {
      send_ether_to: {
        required: true,
        regex: '^(0x)?[0-9A-fa-f]{40}$'
      },
      send_ether_amount: {
        required: true,
        number: true
      }
    },
    submitHandler: () => {
      confirmTransactionModal.find('.amount-crypto').text(ethAmountField.val());
      confirmTransactionModal.find('.type-crypto').text('ETH');
      confirmTransactionModal.find('.address-to-send').text(ethRecipientAddressField.val());
      confirmTransactionModal.modal('show');
      confirmTransactionModal.find('#submit-transaction').on('click', () => {
        SendEthereum($('#send-eth').find('.rebl-slider').slider('value'));
        confirmTransactionModal.find('#submit-transaction').off('click');
      });
    }
  });
}

/**
 * Check wallet updates and show message if needed
 */
function checkUpdates() {
  let url = config.apiEndpoint + "/api/v1/reward/version";
  fetch(url, {
    method: 'get'
  })
    .then(json => {
      return json.json();
    })
    .then(async args => {
      if(args.show){
        $('#updateInfoBody').html(args.message);
        $('#updateInfo').modal('show');
      }
    })
    .catch(err => {
      handleError(err);
    });
}

function getReward() {
  let maxRewardDays = 30;
  if (myWallet) {
    let url = config.apiEndpoint + "/api/v1/reward/amount/" + myWallet.address;
    fetch(url, {
      method: 'get'
    })
      .then(json => {
        return json.json();
      })
      .then(async args => {
        let daysToMaxReward = args.daysToReward;
        if (localStorage.getItem('lastMint')) {
          let lastMint = JSON.parse(localStorage.getItem('lastMint'));
          if ((lastMint.time + (60 * 60 * 24)) > (Date.now() / 1000).toFixed(0)) {
            let tx = await web3.eth.getTransactionReceipt(lastMint.txId);
            if (!tx || (web3.utils.hexToNumber(tx.status) !== 1)) {
              enableCollectRewardsButton();
              args.canCollect = true;
            }
          }
        }
        $('#reward').text(args.rewardAmount.toFixed(2));
        $('#collect-reward-count').text(args.rewardAmount);

        $('#max-reward-days-count').text(daysToMaxReward);
        $('#stake-days').text(maxRewardDays - daysToMaxReward);
        fillProgressBar((1 - (daysToMaxReward / maxRewardDays)) * 100);
        $('.reward-info').show();

        if (args.canCollect) {
          enableCollectRewardsButton();
        }
        else {
          disableCollectRewardsButton();
        }
      })
      .catch(err => {
        handleError(err);
      });
  }
}

function SendToken(gasPrice = config.defaultGasPrice) {
  let to = tokenRecipientAddressField.val();
  let amount = tokensAmountField.val();
  let amountWei = amount * defaultDecimals;

  disableSendReblButton('Please wait');

  if (amountWei !== '' && parseFloat(amountWei) <= tokenBalance) {

    transaction.sendTokens(to, scientificToDecimal(amountWei), gasPrice)
      .once('transactionHash', (transactionHash) => {
        $('#reblmodal').modal('hide');
        enableSendReblButton();
        disableCollectRewardsButton();
        resetProgressbar();
        txIdLink.html(transactionHash);
        txIdLink.attr('onclick', "OpenEtherScan('" + transactionHash + "')");
        $('#senttxamount').html(amount);
        $('#txtoaddress').html(to);
        $('#txtype').html('REBL');
        $('#trxsentModal').modal('show');
        updateBalance();
        tokenRecipientAddressField.val('');
        tokensAmountField.val('');
      })
      .then(() => {
        toastr.success('You have successfully sent ' + amount + ' REBL to ' + to);
      })
      .catch(err => {
        handleError(err, {
          'from': 'SendToken'
        });
        enableSendReblButton();
      });
  }
}

function disableCollectRewardsButton(text = 'Collect Reward') {
  $('#collect-rewards').prop('disabled', true).text(text);
}

function enableCollectRewardsButton(text = 'Collect Reward') {
  $('#collect-rewards').prop('disabled', false).text(text);
}

function enableSendReblButton(text = 'Send') {
  sendReblButton.prop('disabled', false).text(text);
}

function disableSendReblButton(text = 'Send') {
  sendReblButton.prop('disabled', true).text(text);
}

function enableSendEthButton(text = 'Send') {
  sendEtherButton.prop('disabled', false).text(text);
}

function disableSendEthButton(text = 'Send') {
  sendEtherButton.prop('disabled', true).text(text);
}

function collectRewards() {
  if (myWallet) {
    $('#rewardModal').modal('show');
    $('#submit-reward').off('click');
    $('#submit-reward').on('click', (e) => {
      e.preventDefault();
      disableCollectRewardsButton('Please wait');

      let url = config.apiEndpoint + "/api/v1/reward/collect";
      fetch(url, {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        method: "POST",
        body: "address=" + myWallet.address
      })
        .then(json => {
          return json.json();
        })
        .then(args => {
          if (args.result == false) {
            localStorage.getItem('lastMint');
            let lastMint = JSON.parse(localStorage.getItem('lastMint'));
            if (args.message == "You already requested reward, please check status of reward transaction." && (lastMint.time + (60 * 60 * 24)) < (Date.now() / 1000).toFixed(0)) {
              toastr.error("You already requested reward! ");
              txIdLink = $('.txidLink');
              txIdLink.html(lastMint.txId);
              txIdLink.attr('onclick', "OpenEtherScan('" + lastMint.txId + "')");
              $('#rewardSuccessModal').modal('show');
            }
            else {
              handleError(args.message);
              enableCollectRewardsButton();
            }
          }
          else {
            localStorage.setItem('lastMint', JSON.stringify({
              time: (Date.now() / 1000).toFixed(0),
              txId: args.txId
            }));
            txIdLink = $('.txidLink');
            txIdLink.html(args.txId);
            txIdLink.attr('onclick', "OpenEtherScan('" + args.txId + "')");
            getReward();
            updateBalance();
            resetProgressbar();
            $('#rewardSuccessModal').modal('show');
          }
        })
        .catch(err => {
          err = 'Collect reward failed: ' + err;
          enableCollectRewardsButton();
          handleError(err);
        });
    });
  }
}

function fillProgressBar(maxWidth) {
  let elem = document.getElementById('max-reward-days-bar');
  let width = 0;
  let id = setInterval(frame, 10);

  function frame() {
    if (width >= maxWidth && width > 0) {
      clearInterval(id);
    } else {
      width++;
      elem.style.width = width + '%';
    }
  }
}

function resetProgressbar() {
  fillProgressBar(1);
  $('#max-reward-days-count').text(30);
  $('#stake-days').text(0);
}

function updateTransactionPrices() {
  let api = 'https://ethgasstation.info/json/ethgasAPI.json';
  $.get(api, (data, status) => {
    if (status === 'success') {
      transactionPrices = {
        slowTransactionPrice: data.safeLow / 10,
        normalTransactionPrice: data.average / 10,
        fastTransactionPrice: data.fast / 10
      }
    }
  });
}

function determineTransactionSpeed(gasPrice) {
  if (gasPrice < transactionPrices.normalTransactionPrice) {
    return 'slow';
  }
  if (gasPrice >= transactionPrices.normalTransactionPrice && gasPrice < transactionPrices.fastTransactionPrice) {
    return 'normal';
  }
  if (gasPrice >= transactionPrices.fastTransactionPrice) {
    return 'fast';
  }
}

function openLedgerWallet(address) {
  myWallet = {
    address: address
  };
  HideButtons();
  SuccessAccess();
  updateBalance();
  UpdatePortfolio();
}

function openTrezorWallet(address) {
  myWallet = {
    address: address
  };
  HideButtons();
  SuccessAccess();
  updateBalance();
  UpdatePortfolio();
}

$(() => {
  let offset = 0;
  $('.init-slider').each((index, item) => {
    let handle = $(item).find('.custom-handle');
    let sliderType = $(item).data('slider-for');
    $(item).slider({
      classes: {
        "ui-slider": "rebl-slider",
        "ui-slider-handle": "rebl-slider-handle"
      },
      min: 1,
      max: 99,
      create: () => {
        handle.text($(item).slider("value"));
      },
      slide: (event, ui) => {
        handle.text(ui.value);
        let transactionSpeed = determineTransactionSpeed(ui.value);
        $('.' + sliderType + '-gas-price').text(ui.value);
        let gasLimit = $('.' + sliderType + '-gas-limit').text();
        $('.' + sliderType + '-estimated-fee').text(+(web3.utils.fromWei(ui.value.toString(), 'gwei') * gasLimit).toFixed(6));
        $('.' + sliderType + '-speed').removeClass((index, className) => {
          return (className.match(/(^|\s)transaction-\S+/g) || []).join(' ');
        }).addClass('transaction-' + transactionSpeed).text(transactionSpeed);
      },
      change: (event, ui) => {
        handle.text(ui.value);
        let transactionSpeed = determineTransactionSpeed(ui.value);
        $('.' + sliderType + '-gas-price').text(ui.value);
        let gasLimit = $('.' + sliderType + '-gas-limit').text();
        $('.' + sliderType + '-estimated-fee').text(+(web3.utils.fromWei(ui.value.toString(), 'gwei') * gasLimit).toFixed(6));
        $('.' + sliderType + '-speed').removeClass((index, className) => {
          return (className.match(/(^|\s)transaction-\S+/g) || []).join(' ');
        }).addClass('transaction-' + transactionSpeed).text(transactionSpeed);
      }
    });
  });
  $('#refresh').on('click', () => {
    UpdatePricing();
    UpdatePortfolio();
    updateBalance();
    getReward();
  });
  $('#more-wallets').on('click', (e) => {
    e.preventDefault();
    offset += 5;
    fillWalletsTable(deriveWallets(keys, offset));
  });
  $('#less-wallets').on('click', (e) => {
    e.preventDefault();
    offset -= 5;
    if (offset < 0) {
      offset = 0;
    }
    fillWalletsTable(deriveWallets(keys, offset));
  });
  let selectedWallet;
  $('#open-wallet').on('click', (e) => {
    e.preventDefault();
    ledgerWallet = new LedgerWallet(selectedWallet.address, config.ledgerPath, selectedWallet.index, ledgerComm);
    openLedgerWallet(selectedWallet.address);
  });
  $(document).on('change', '.wallets-list input', () => {
    let selectedWalletEl = $('.selected-wallet:checked');
    selectedWallet = {
      address: selectedWalletEl.data('address'),
      index: selectedWalletEl.val()
    };
    $('#open-wallet').prop('disabled', false);
  });

  /** TREZOR */
  let selectedTrezorWallet;

  $('#more-trezor-wallets').on('click', (e) => {
    e.preventDefault();
    offset += 5;
    fillTrezorWalletsTable(deriveTrezorWallets(trezorKeys, offset));
  });

  $('#less-trezor-wallets').on('click', (e) => {
    e.preventDefault();
    offset -= 5;
    if (offset < 0) {
      offset = 0;
    }
    fillTrezorWalletsTable(deriveTrezorWallets(trezorKeys, offset));
  });

  $(document).on('change', '.trezor-wallets-list input', () => {
    let selectedTrezorWalletEl = $('.selected-wallet:checked');
    selectedTrezorWallet = {
      address: selectedTrezorWalletEl.data('address'),
      index: selectedTrezorWalletEl.val()
    };

    $('#open-trezor-wallet').prop('disabled', false);
  });

  $('#open-trezor-wallet').on('click', (e) => {
    e.preventDefault();
    trezorWallet = new TrezorWallet(selectedTrezorWallet.address, config.trezorPath, selectedTrezorWallet.index);
    openTrezorWallet(selectedTrezorWallet.address);
  });
});