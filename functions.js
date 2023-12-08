import {KintoneRestAPIClient} from '@kintone/rest-api-client';
import dotenv from 'dotenv';
import process from 'process';
import logUpdate from 'log-update';
import {kintoneApps} from './init.js';

dotenv.config();

const client = new KintoneRestAPIClient({
  baseUrl: process.env.HOST,
  auth: {
    username: process.env.USER,
    password: process.env.PASS,
  },
});

// const tableCredsRef = kintoneApps.customersListApp.fieldCode.table;

const functions = {
  showLoadingFrames: () => {
    const frames = [
      'loading',
      'loading.',
      'loading..',
      'loading...',
      'loading....',
    ];

    let i = 0;
    const mInterval = setInterval(() => {
      const frame = frames[i++ % frames.length];
      logUpdate(frame);
    }, 100);

    return mInterval;
  },
  getClient: (params) => {
    const {baseUrl, username, password} = params;
    const opt = {
      baseUrl,
      auth: {
        username,
        password,
      }
    };

    return new KintoneRestAPIClient(opt);
  },
  getApp: (userClient, appId) => {
    const appInterval = functions.showLoadingFrames();

    return userClient.app.getApp({
      id: appId,
    }).then(resp => {
      logUpdate.clear();
      clearInterval(appInterval);

      return {
        appId: resp.appId,
        name: resp.name,
      };
    }).catch(error => {
      const {message, id, code} = error;

      logUpdate.clear();
      clearInterval(appInterval);

      const errMsg = {
        error: {
          message,
          id,
          code,
          note: 'Please re-init the config.'
        }
      };

      console.log(errMsg);

      return null;
    });
  },
  getCustomersList: (customerName) => {
    const customerInterval = functions.showLoadingFrames();

    const condition = `${kintoneApps.customersListApp.fieldCode.customerName} like "${customerName}"`;
    return client.record.getAllRecords({
      app: kintoneApps.customersListApp.id,
      condition,
    }).then((resp) => {
      logUpdate.clear();
      clearInterval(customerInterval);

      return resp;
    });
  },
};

export {functions};