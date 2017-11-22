const {shell} = require('electron');
const {dialog} = require('electron').remote;
const clipboardy = require('clipboardy');
let fs = require('fs');
let config = require('./config');
let Transaction = require('./js/transaction');
let Web3 = require('web3');
let web3 = new Web3(new Web3.providers.HttpProvider(config.networkProvider));
let log = require('electron-log');

let myWallet;
let contract = new web3.eth.Contract(config.tokenAbi, config.tokenAddress);
let transaction;

let tokenBalance = 0;
let ethBalance = 0;
let version = "0.0.1";

let reblUSD = 0;
let etherUSD = 0;

const defaultDecimals = 1000000000000000000;

let keyStoreButton = $('#keystorebtn');
let keyStoreJsonError = $('#keystorejsonerror');
let sendEtherButton = $('#sendethbutton');
let sendReblButton = $('#sendtokenbutton');
let txIdLink = $('.txidLink');
let tokenRecipientAddressField = $('#send_to_token');
let tokensAmountField = $('#send_amount_token');
let ethRecipientAddressField = $('#send_ether_to');
let ethAmountField = $('#send_ether_amount');

function OpenEtherScan(txid) {
  shell.openExternal('https://etherscan.io/tx/'+txid)
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

function ReblPrice() {
  let api = "https://api.coinmarketcap.com/v1/ticker/rebl/";
  $.get(api, function(data, status){
     reblUSD = parseFloat(data[0]['price_usd']);
  });
}

function EtherPrice() {
  let api = "https://api.coinmarketcap.com/v1/ticker/ethereum/";
  $.get(api, function(data, status){
     etherUSD = parseFloat(data[0]['price_usd']);
  });
}

UpdatePricing();

function UpdatePricing() {
  EtherPrice();
  ReblPrice();
}

function UpdatePortfolio() {
  setTimeout(function() {
    let totalRebl = tokenBalance * reblUSD;
    let totalEth = ethBalance * etherUSD;
    let totalPort = totalRebl + totalEth;
    $('#portReblUSD').html("($"+reblUSD+")");
    $('#portEthUSD').html("($"+etherUSD+")");
    $('#portfolioRebl').html(totalRebl.toFixed(2));
    $('#portfolioEth').html(totalEth.toFixed(2));
    $('#portfolioTotal').html(totalPort.toFixed(2));
    $('.portfolio').fadeIn('fast');
  }, 3500);
}

activateValidators();

function CheckForUpdates() {
  let versionFile = "https://raw.githubusercontent.com/hunterlong/storj-wallet/master/VERSION";
  $.get(versionFile, function(data, status){
    let verCheck = data.replace(/^\s+|\s+$/g, '');
    if (version !== verCheck) {
      alert("There's a new Update for Rebellious Wallet! New Version: "+data);
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

setInterval(function() {
  if (myWallet) {
    updateBalance();
  }
}, 5000);

setInterval(function() {
  if (myWallet) {
    UpdatePortfolio();
  }
}, 30000);

setInterval(function() {
  if (myWallet) {
    getReward();
  }
}, 300000);

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
  clipboardy.writeSync(myWallet.address);
  alert("Address Copied: " + myWallet.address);
}

function HideButtons() {
  $('#keystoreupload').attr('class', 'hidden');
  $('#createnewwallet').attr('class', 'hidden');
  $('#privatekey').attr('class', 'hidden');
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
      log.error(e);
      alert(e);
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

function updateBalance() {
  let address = myWallet.address;
  $('.myaddress').html(address);

  web3.eth.getBalance(address).then(balance => {
    let etherString = web3.utils.fromWei(balance, 'ether');
    let n = parseFloat(etherString);
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
  });

  let contract = new web3.eth.Contract(config.tokenAbi, config.tokenAddress);
  let getReblBalance = contract.methods.balanceOf(address).call();

  getReblBalance.then(balance => {
    let messageEl = $('#reblbal');
    let n = balance * (1 / defaultDecimals);

    let reblValue = n.toLocaleString(
      'en-US',
      {
        minimumFractionDigits: 8
      }
    );

    let split = reblValue.split(".");
    tokenBalance = balance;
    $('.reblspend').html(reblValue);
    messageEl.html(split[0] + ".<small>" + split[1] + "</small>");

  });

}

let keyFile;
function OpenKeystoreFile() {
  dialog.showOpenDialog(function(fileNames) {
    if (fileNames === undefined) return;
    keyFile = fileNames[0];
    $('.open-key-store').css({color:'#fff', backgroundColor: 'rgb(0, 171,178)'});
  });
}

function SuccessAccess() {
  transaction = new Transaction(myWallet);
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
  if(to.match(/^(0x)?[0-9A-fa-f]{40}$/) && amount !== '') {
    transaction.estimateFeeForEth(to, amount).then(result => {
      let gasPrice = web3.utils.fromWei(web3.utils.hexToNumber(result.gasPrice));
      $('.eth-gas-limit').text(result.gas);
      $('.eth-gas-price').text(gasPrice);
      $('.eth-estimated-fee').text((result.gas * gasPrice).toFixed(10) + ' ETH');
    }).catch(err => {
      log.error(err);
      alert(err);
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
  if(to.match(/^(0x)?[0-9A-fa-f]{40}$/) && amount !== '') {
    transaction.estimateFeeForTokens(to, amount).then(result => {
      let gasPrice = web3.utils.fromWei(web3.utils.hexToNumber(result.gasPrice));
      $('.rebl-gas-limit').text(result.gas);
      $('.rebl-gas-price').text(gasPrice);
      $('.rebl-estimated-fee').text((result.gas * gasPrice).toFixed(10) + ' ETH');
    }).catch(err => {
      log.error(err);
      alert(err);
    });
  }
  return false;
}

function UnlockWalletKeystore() {
  let password = $('#keystorewalletpass').val();
  let buffer = fs.readFileSync(keyFile);
  let walletData = buffer.toString();
  keyStoreButton.html('Decrypting...');
  keyStoreButton.prop('disabled', true);

  if (keyFile !== ''){
    try {
      myWallet = web3.eth.accounts.decrypt(JSON.parse(walletData.toLowerCase()), password);
      SuccessAccess();
      updateBalance();
      UpdatePortfolio();
      keyStoreButton.html('Decrypting...');
    } catch (e) {
      keyStoreJsonError.html(e);
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

function SendEthereum(callback) {
  let to = ethRecipientAddressField.val();
  let amount = ethAmountField.val();

  disableSendEthButton('Please wait');

  if (amount !== '' && parseFloat(amount) <= ethBalance) {
    transaction.sendEther(to, amount).then(res => {
      enableSendEthButton();
      $('#ethermodal').modal('hide');
      txIdLink.html(res.transactionHash);
      txIdLink.attr('onclick', "OpenEtherScan('"+res.transactionHash+"')");
      $('#senttxamount').html(amount);
      $('#txtoaddress').html(to);
      $('#txtype').html('ETH');
      $('#trxsentModal').modal('show');
      updateBalance();
      ethRecipientAddressField.val('');
      ethAmountField.val('');
    }).catch(e => {
      log.error(e);
      alert(e);
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
  $('.ethavailable').each(function(){
    $(this).html(ethBalance.toFixed(6));
  });
}

function showSend(type) {
  $('div[class*=send-crypto]').addClass('hidden');
  $('.send-'+type+'-wrapper').toggleClass('hidden');
  $('.send-receive-tabs-content').addClass('hidden');
  $('.nav-tabs .active a').addClass('back-send').text('back');
}

function goBack(self) {
  if($(self).hasClass('back-send')) {
    $('div[class*=send-crypto]').addClass('hidden');
    $('.send-receive-tabs-content').removeClass('hidden');
    $(self).removeClass('back-send').text('send');
  }
  getReward();
}

function restoreSend(self) {
  if($(self).parent().siblings().find('a').hasClass('back-send')) {
    // alert();
    goBack($(self).parent().siblings().find('a'));
  }
}

function scientificToDecimal(num) {
  //if the number is in scientific notation remove it
  if(/\d+\.?\d*e[\+\-]*\d+/i.test(num)) {
    let zero = '0',
      parts = String(num).toLowerCase().split('e'), //split into coeff and exponent
      e = parts.pop(),//store the exponential part
      l = Math.abs(e), //get the number of zeros
      sign = e/l,
      coeff_array = parts[0].split('.');
    if (sign === -1) {
      num = zero + '.' + new Array(l).join(zero) + coeff_array.join('');
    }
    else {
      let dec = coeff_array[1];
      if(dec) l = l - dec.length;
      num = coeff_array.join('') + new Array(l+1).join(zero);
    }
  }

  return num;
}

$.validator.addMethod(
  'regex',
  function(value, element, regexp) {
    let re = new RegExp(regexp);
    return this.optional(element) || re.test(value);
  },
  'Address is invalid, please enter a valid address'
);

function activateValidators() {
  let confirmTransactionModal = $('#confirmTransaction');
  $('#send-rebl').on('submit', (e) => {
    e.preventDefault();
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
        SendToken();
        confirmTransactionModal.find('#submit-transaction').off('click');
      });
    }
  });
  $('#send-eth').on('submit', (e) => {
    e.preventDefault();
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
        SendEthereum();
        confirmTransactionModal.find('#submit-transaction').off('click');
      });
    }
  });
}

function getReward() {
  let interestMethod = contract.methods.annualInterest();
  interestMethod.call({from: myWallet.address}).then(interest => {
    let coinAgeMethod = contract.methods.coinAge();
    coinAgeMethod.call({from: myWallet.address}).then(coinAge => {
      let reward = (coinAge * interest) / (365 * defaultDecimals);
      reward = reward / defaultDecimals;
      reward = reward.toLocaleString(
        'en-US',
        {
          minimumFractionDigits: 8
        }
      );

      $('#reward').text(reward);
      if(parseFloat(reward) > 0) {
        enableCollectRewardsButton();
      }
    }).catch(err => {
      log.error(err);
      alert(err);
    });
  }).catch(err => {
    log.error(err);
    alert(err);
  });
}

function SendToken(callback) {
  let to = tokenRecipientAddressField.val();
  let amount = tokensAmountField.val() * defaultDecimals;

  disableSendReblButton('Please wait');

  if (amount !== '' && parseFloat(amount) <= tokenBalance) {

    transaction.sendTokens(to, scientificToDecimal(amount)).then(res => {
      $('#reblmodal').modal('hide');
      enableSendReblButton();
      getReward();
      txIdLink.html(res.transactionHash);
      txIdLink.attr('onclick', "OpenEtherScan('"+res.transactionHash+"')");
      $('#senttxamount').html(amount / defaultDecimals);
      $('#txtoaddress').html(to);
      $('#txtype').html('REBL');
      $('#trxsentModal').modal('show');
      updateBalance();
      tokenRecipientAddressField.val('');
      tokensAmountField.val('');
    })
    .catch(err => {
      log.error(err);
      alert(err);
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
  disableCollectRewardsButton('Please wait');

  transaction.mint().then(result => {
    alert('Reward is successful');
    getReward();
    updateBalance();
    disableCollectRewardsButton();
  }).catch(err => {
    enableCollectRewardsButton();
    log.error('Collect reward failed: ' + err);
    alert(err);
  });
}