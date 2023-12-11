import {KintoneRestAPIClient} from '@kintone/rest-api-client';
import dotenv from 'dotenv';
import process from 'process';
import logUpdate from 'log-update';
import {kintoneApps} from './init.js';
import {createSpinner} from 'nanospinner';
import {execSync} from 'child_process';
import fs from 'fs';

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
  showSpinner: (opt) => {
    const spinner = createSpinner();

    spinner.start(opt);

    return spinner;
  },
  stopSpinner: (spinner, isSuccess = true) => {
    const method = isSuccess ? 'success' : 'error';
    const msg = isSuccess ? 'Success' : 'Error';
    spinner[method]({
      text: msg
    });
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
  getCustomersList: (customerName) => {
    const spinner = functions.showSpinner({
      text: 'Getting Customers List.',
      color: 'yellow',
    });

    const condition = `${kintoneApps.customersListApp.fieldCode.customerName} like "${customerName}"`;
    return client.record.getAllRecords({
      app: kintoneApps.customersListApp.id,
      condition,
    }).then((resp) => {
      if (!resp.length) {
        console.log('No customer found. please refine your search.');
        functions.stopSpinner(spinner, false);

        return resp;
      }

      functions.stopSpinner(spinner, {
        text: 'Completed!',
        color: 'green',
      });

      return resp;
    });
  },
  getApp: (userClient, appId) => {
    const spinner = functions.showSpinner({
      text: 'Getting Related App.',
      color: 'yellow',
    });

    return userClient.app.getApp({
      id: appId,
    }).then(resp => {
      functions.stopSpinner(spinner);

      return {
        appId: resp.appId,
        name: resp.name,
      };
    }).catch(error => {
      const {message, id, code} = error;

      functions.stopSpinner(spinner, false);

      const errMsg = {
        error: {
          message,
          id,
          code,
          note: 'Wrong config. Please re-init the config with correct information. Make sure the DOMAIN, APP, AND USER match.'
        }
      };

      for (const component in errMsg.error) {
        if (Object.hasOwnProperty.call(errMsg.error, component)) {
          const msg = errMsg.error[component];
          console.log(`${component}: ${msg}`);
        }
      }

      throw error;
    });
  },
  callUploader: (type) => {
    let args = '';

    if (type === 'init') {
      args += 'init';
    }

    if (type === 'import') {
      const readConfig = JSON.parse(fs.readFileSync('./config/basic-config.json'));
      const {baseUrl, username, password} = readConfig;

      args += `import dest\\customize-manifest.json --base-url ${baseUrl} --username ${username} --password ${password}`;
    }

    const cliPath = `.\\node_modules\\@kintone\\customize-uploader\\bin\\cli.js ${args}`;

    try {
      execSync(`node ${cliPath}`, {stdio: 'inherit'});
    } catch (error) {
      console.error(`Error running kintone-customize-uploader: ${error.message}`);
    }
  }
};

export {functions};