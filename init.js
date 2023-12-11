const kintoneApps = {
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
};
const configJson = {
  appId: null,
  baseUrl: null,
  username: null,
  password: null,
  isEligibleConfig: false,
};

export {kintoneApps, configJson};
