const init = {
  kintoneApps: {
    customersListApp: {
      id: 781,
      fieldCode: {
        customerName: 'Customer_Name',
        contractStatus: 'ContractStatus',
        table: {
          code: 'Credential',
          columns: {
            accountType: 'Account_Type',
            url: 'URL',
            userName: 'Username',
            password: 'Password',
            uploaderFlag: 'Uploader_Flag',
          },
        },
      },
    },
  },
  configJson: {
    appId: null,
    url: null,
    user: null,
    password: null,
  },
};

module.exports = init;
