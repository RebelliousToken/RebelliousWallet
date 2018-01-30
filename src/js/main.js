const {shell} = require('electron');
const {dialog} = require('electron').remote;
let fs = require('fs');
let config = require('./config');
let Transaction = require('./js/transaction');
let Web3 = require('web3');
let log = require('electron-log');
let toastr = require('toastr');

let currentProvider = 'infura';
let web3 = new Web3(new Web3.providers.HttpProvider(config.networkProvider[currentProvider]));

let myWallet;
let contract = new web3.eth.Contract(config.tokenAbi, config.tokenAddress);
let transaction;

let tokenBalance = 0;
let ethBalance = 0;
let version = "0.0.2";

let reblUSD = 0;
let etherUSD = 0;

let transactionPrices = {
  slowTransactionPrice: config.slowTransactionPriceDown,
  normalTransactionPrice: config.normalTransactionPriceDown,
  fastTransactionPrice: config.fastTransactionPriceDown
};

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

toastr.options = {
    "closeButton": true,
    "debug": false,
    "newestOnTop": false,
    "progressBar": false,
    "positionClass": "toast-top-left",
    "preventDuplicates": false,
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

checkNet();
updateTransactionPrices();

function checkNet() {
  web3.eth.getProtocolVersion().catch(e => {
    handleError(e, {
      'function': checkNet,
      'from': 'check'
    })
  });
}

function handleError(e, action = false) {
  log.error(e, action['from']);
  if(currentProvider === 'infura' && action['function']) {
    currentProvider = 'giveth';
    web3.setProvider(config.networkProvider[currentProvider]);
    contract = new web3.eth.Contract(config.tokenAbi, config.tokenAddress);
    action['args'] = action['args'] ? action['args'] : [];
    action['function'](...action['args']);
  }
  else if (e == 'Error: Invalid JSON RPC response: ""' || e == "Error: Couldn't decode uint256 from ABI: 0x") {
    toastr.error('Requested API server currently not responding. Please try again later.');
  }
  else if (e == 'Error: Returned error: insufficient funds for gas * price + value null') {
    toastr.error("Your wallet's ETH balance is not enough to cover the gas cost. Please deposit some ETH into your wallet.");
  }
  else {
    toastr.error(e);
  }
}

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
  let api = "https://api.coinmarketcap.com/v1/ticker/rebellious/";
  $.get(api, (data, status) => {
    if(status === 'success') {
      reblUSD = parseFloat(data[0]['price_usd']);
    }
  });
}

function EtherPrice() {
  let api = "https://api.coinmarketcap.com/v1/ticker/ethereum/";
  $.get(api, (data, status) => {
    if(status === 'success') {
      etherUSD = parseFloat(data[0]['price_usd']);
    }
  });
}

UpdatePricing();

function UpdatePricing() {
  EtherPrice();
  ReblPrice();
}

function UpdatePortfolio() {
  setTimeout(() => {
    let totalRebl = tokenBalance * reblUSD / defaultDecimals;
    let totalEth = ethBalance * etherUSD;
    let totalPort = totalRebl + totalEth;
    $('#portReblUSD').html("($"+reblUSD.toFixed(2)+")");
    $('#portEthUSD').html("($"+etherUSD.toFixed(2)+")");
    $('#portfolioRebl').html(totalRebl.toFixed(2));
    $('#portfolioEth').html(totalEth.toFixed(2));
    $('#portfolioTotal').html(totalPort.toFixed(2));
    $('.portfolio').fadeIn('fast');
  }, 3500);
}

activateValidators();

function CheckForUpdates() {
  let versionFile = "https://raw.githubusercontent.com/hunterlong/storj-wallet/master/VERSION";
  $.get(versionFile, (data, status) => {
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
}, 300000);

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
  }).catch(err => {
    handleError(err, {
      'function': updateBalance,
      'from': 'updateBalance'
    });
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

  }).catch(err => {
    handleError(err, {
      'function': updateBalance,
      'from': 'updateBalance'
    });
  });

}

let keyFile;
function OpenKeystoreFile() {
  dialog.showOpenDialog(fileNames => {
    if (fileNames === undefined) return;
    keyFile = fileNames[0];
    $('.open-key-store').css({color:'#fff', backgroundColor: 'rgb(0, 171,178)'});
  });
}

function SuccessAccess() {
  localStorage.clear();
  transaction = new Transaction(myWallet, web3, contract);
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
  if(to.match(/^(0x)?[0-9A-fa-f]{40}$/) && amount !== '') {
  let gasPrice = transactionPrices.normalTransactionPrice;
  $('.eth-gas-limit').text(config.gasLimitFor['eth']);
  $('.eth-gas-price').text(gasPrice);
  $('.eth-estimated-fee').text((config.gasLimitFor['eth'] * gasPrice).toFixed(10) + ' ETH');
  $('.eth-gas-limit').parent().parent().find('.init-slider').slider( 'value', gasPrice );
  $('.eth-gas-limit').parent().parent().find('.init-slider').slider( 'enable' );
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
  if(to.match(/^(0x)?[0-9A-fa-f]{40}$/) && amount !== '') {
  let gasPrice = transactionPrices.normalTransactionPrice;
  $('.rebl-gas-limit').text(config.gasLimitFor['rebl']);
  $('.rebl-gas-price').text(gasPrice);
  $('.rebl-estimated-fee').text((config.gasLimitFor['rebl'] * gasPrice).toFixed(10) + ' ETH');
  $('.rebl-gas-limit').parent().parent().find('.init-slider').slider( 'value', gasPrice );
  $('.rebl-gas-limit').parent().parent().find('.init-slider').slider( 'enable' );
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
    transaction.sendEther(to, amount, gasPrice).then(transactionHash => {
      enableSendEthButton();
      $('#ethermodal').modal('hide');
      txIdLink.html(transactionHash);
      txIdLink.attr('onclick', "OpenEtherScan('"+transactionHash+"')");
      $('#senttxamount').html(amount);
      $('#txtoaddress').html(to);
      $('#txtype').html('ETH');
      $('#trxsentModal').modal('show');
      updateBalance();
      ethRecipientAddressField.val('');
      ethAmountField.val('');
    }).catch(e => {
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
      getRewardTime();
      if(parseFloat(reward) > 0) {
        enableCollectRewardsButton();
      }
      else {
        $('.reward-info').show();
      }
    }).catch(err => {
      handleError(err, {
        'function': getReward,
        'from': 'getReward'
      });
    });
  }).catch(err => {
    handleError(err, {
      'function': getReward,
      'from': 'getReward'
    });
  });
}

function SendToken(gasPrice = config.defaultGasPrice) {
  let to = tokenRecipientAddressField.val();
  let amount = tokensAmountField.val() * defaultDecimals;

  disableSendReblButton('Please wait');

  if (amount !== '' && parseFloat(amount) <= tokenBalance) {

    transaction.sendTokens(to, scientificToDecimal(amount), gasPrice).then(transactionHash => {
      $('#reblmodal').modal('hide');
      enableSendReblButton();
      getReward();
      txIdLink.html(transactionHash);
      txIdLink.attr('onclick', "OpenEtherScan('"+transactionHash+"')");
      $('#senttxamount').html(amount / defaultDecimals);
      $('#txtoaddress').html(to);
      $('#txtype').html('REBL');
      $('#trxsentModal').modal('show');
      updateBalance();
      tokenRecipientAddressField.val('');
      tokensAmountField.val('');
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
  $('#submit-mint').off('click');
  let slider = $('#mintModal').find('.init-slider');
  slider.slider('disable');
  $('#mintModal').modal('show');
  slider.slider('value', transactionPrices.normalTransactionPrice);
  slider.slider('enable');
  $('#submit-mint').on('click', (e) => {
    e.preventDefault();
    disableCollectRewardsButton('Please wait');
    transaction.mint(slider.slider('value')).then(transactionHash => {
      txIdLink.html(transactionHash);
      txIdLink.attr('onclick', "OpenEtherScan('"+transactionHash+"')");
      $('#mintSuccessModal').modal('show');
      getReward();
      updateBalance();
      disableCollectRewardsButton();
      resetProgressbar();
    }).catch(err => {
      if (err == "Error: Returned error: insufficient funds for gas * price + value") {
        err = "Your wallet's ETH balance is not enough to cover the gas cost. Please deposit some ETH into your wallet.";
      }
      else {
        err = 'Collect reward failed: ' + err;
      }
      enableCollectRewardsButton();
      handleError(err);
    });
  });
}

async function getRewardTime() {
  const maxRewardDays = 30;
  let transferEvents = await contract.getPastEvents('Transfer', {
    filter: {
      from: myWallet.address
    },
    fromBlock: 0
  });
  let mintEvents = await contract.getPastEvents('Mint', {
    filter: {
        _address: myWallet.address
    },
    fromBlock: 0
  });
  let latestTransferBlock;
  let latestMintBlock;
  let maxBlockNumber;
  let block;
  let daysToMaxReward;
  if(transferEvents.length && mintEvents.length) {
    latestTransferBlock = transferEvents[transferEvents.length-1].blockNumber;
    latestMintBlock = mintEvents[mintEvents.length-1].blockNumber;
    maxBlockNumber = latestTransferBlock > latestMintBlock ? latestTransferBlock : latestMintBlock;
  } else if(transferEvents.length && !mintEvents.length) {
      maxBlockNumber = transferEvents[transferEvents.length-1].blockNumber;
  } else if(!transferEvents.length && mintEvents.length) {
      maxBlockNumber = mintEvents[mintEvents.length-1].blockNumber;
  } else if(!transferEvents.length && !mintEvents.length) {
    transferEvents = await contract.getPastEvents('Transfer', {
      filter: {
          to: myWallet.address
      },
      fromBlock: 0
    });
    if(transferEvents.length) {
      maxBlockNumber = transferEvents[0].blockNumber;
    } else {
      return;
    }
  }
  block = await web3.eth.getBlock(maxBlockNumber);
  daysToMaxReward = (maxRewardDays - (((Date.now() / 1000) - (block.timestamp)) / 60 / 60 / 24)).toFixed(0);
  if (daysToMaxReward < 0) {
    daysToMaxReward = 0;
  }
  $('.reward-info').show();
  $('#max-reward-days-count').text(daysToMaxReward);
  $('#stake-days').text(maxRewardDays - daysToMaxReward);
  fillProgressBar((1 - (daysToMaxReward / maxRewardDays)) * 100);
}

function fillProgressBar(maxWidth) {
  let elem = document.getElementById('max-reward-days-bar');
  let width = 0;
  let id = setInterval(frame, 10);
  function frame() {
    if (width >= maxWidth) {
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
}

function updateTransactionPrices() {
  let api = 'https://ethgasstation.info/json/ethgasAPI.json';
  $.get(api, (data, status) => {
    if(status === 'success') {
      transactionPrices = {
        slowTransactionPrice: data.safeLow / 10,
        normalTransactionPrice: data.average / 10,
        fastTransactionPrice: data.fast / 10
      }
    }
  });
}

function determineTransactionSpeed(gasPrice) {
  if((gasPrice >= transactionPrices.slowTransactionPrice && gasPrice < transactionPrices.normalTransactionPrice) ||
      gasPrice < transactionPrices.slowTransactionPrice) {
    return 'slow';
  }
  if(gasPrice >= transactionPrices.normalTransactionPrice && gasPrice < transactionPrices.fastTransactionPrice) {
    return 'normal';
  }
  if(gasPrice >= transactionPrices.fastTransactionPrice) {
    return 'fast';
  }
}

$(() => {
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
        handle.text($( item ).slider("value"));
      },
      slide: (event, ui) => {
        handle.text(ui.value);
        let transactionSpeed = determineTransactionSpeed(ui.value);
        $('.'+sliderType+'-gas-price').text(ui.value);
        $('.'+sliderType+'-estimated-fee').text(+(web3.utils.fromWei(ui.value.toString(), 'gwei')*config.gasLimitFor[sliderType]).toFixed(6));
        $('.'+sliderType+'-speed').removeClass((index, className) => {
          return (className.match (/(^|\s)transaction-\S+/g) || []).join(' ');
        }).addClass('transaction-'+transactionSpeed).text(transactionSpeed);
      },
      change: (event, ui) => {
        handle.text(ui.value);
        let transactionSpeed = determineTransactionSpeed(ui.value);
        $('.'+sliderType+'-gas-price').text(ui.value);
        $('.'+sliderType+'-estimated-fee').text(+(web3.utils.fromWei(ui.value.toString(), 'gwei')*config.gasLimitFor[sliderType]).toFixed(6));
        $('.'+sliderType+'-speed').removeClass((index, className) => {
          return (className.match (/(^|\s)transaction-\S+/g) || []).join(' ');
        }).addClass('transaction-'+transactionSpeed).text(transactionSpeed);
      }
    });
  });
  $('#refresh').on('click', () => {
    UpdatePricing();
    UpdatePortfolio();
    updateBalance();
    getReward();
  });
});