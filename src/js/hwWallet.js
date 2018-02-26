class HwWallet {
  constructor(address, dPath, index) {
    this.address = address;
    this.dPath = dPath;
    this.index = index;
  }

  getAddressString() {
    return Promise.resolve(this.address);
  }

  getPath() {
    return `${this.dPath}/${this.index}`;
  }
}

export default HwWallet;