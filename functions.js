const { KintoneRestAPIClient } = require("@kintone/rest-api-client");
require('dotenv').config()
const client = new KintoneRestAPIClient({
  baseUrl: process.env.HOST,
  auth: {
    username: process.env.USER,
    password: process.env.PASS,
  }
})
const {kintoneApps} = require('./init');
const tableCredsRef = kintoneApps.customersListApp.fieldCode.table;

const functions = {
  getCustomersList: (customerName) => {
    const condition = `${kintoneApps.customersListApp.fieldCode.customerName} like "${customerName}"`
    console.log({condition});
    return client.record.getAllRecords({
      app: kintoneApps.customersListApp.id,
      condition,
    });
  }
}

module.exports = functions;