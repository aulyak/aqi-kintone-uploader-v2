#!/usr/bin/env node
/* eslint-disable max-statements */

import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';
import {fileURLToPath} from 'url';
import process, {exit} from 'process';
import {KintoneRestAPIClient} from '@kintone/rest-api-client';
import inquirer from 'inquirer';
import {functions} from './functions.js';
import {kintoneApps, configJson} from './init.js';

const currentScriptPath = fileURLToPath(import.meta.url);
const envFilePath = path.join(path.dirname(currentScriptPath), '.', '.env');
dotenv.config({
  path: envFilePath,
});

(async () => {
  let masterClient;
  const prompt = inquirer.createPromptModule();
  const tableRef = kintoneApps.customersListApp.fieldCode.table;

  const args = process.argv.slice(2);
  const usedMainArg = args[0];
  const restArgs = [...args].splice(1);

  if (usedMainArg !== 'setup') {
    try {
      masterClient = new KintoneRestAPIClient({
        baseUrl: process.env.HOST,
        auth: {
          username: process.env.USER,
          password: process.env.PASS,
        },
      });
    } catch (error) {
      console.error('Please set the .env by running "setup". Make sure the base url, username, and password are correct.');
      process.exit(1);
    }
  }

  if (usedMainArg === 'init') {
    functions.callUploader('init');

    const lookupOptions = [
      {
        type: 'list',
        name: 'isAutomaticLookupConfig',
        message: 'Do you want to automatically lookup config by customer?',
        choices: [
          {
            name: 'Yes.',
            value: true,
          },
          {
            name: "No. I'll input it manually. (recommended for internal use)",
            value: false,
          },
        ],
      },
    ];

    const answerLookupOptions = await prompt(lookupOptions);
    const {isAutomaticLookupConfig} = answerLookupOptions;

    if (isAutomaticLookupConfig) {
      const customerQuestion = [
        {
          type: 'input',
          name: 'customerName',
          message: 'Search customer name:',
        },
      ];

      let customersList = [];

      while (!customersList.length) {
        const answersCustomer = await prompt(customerQuestion);
        const {customerName} = answersCustomer;
        try {
          customersList = await functions.getCustomersList(customerName, masterClient);
        } catch {
          return;
        }
      }

      const customersOption = [
        {
          type: 'list',
          name: 'chosenCustomer',
          message: 'Select customer:',
          choices: customersList.map((item) => ({
            name: item[kintoneApps.customersListApp.fieldCode.customerName].value,
            value: item.$id.value,
          })),
        },
      ];

      let chosenCustomer = customersOption[0].choices[0].value;

      if (customersList.length > 1) {
        const answersOption = await prompt(customersOption);
        chosenCustomer = answersOption.chosenCustomer;
      }

      const customer = customersList.find((item) => item.$id.value === chosenCustomer);

      const table = customer[tableRef.code].value;

      const filteredOptions = table.filter((item) => item.value[tableRef.columns.accountType].value === 'Kintone Maintenance Account');

      const mappedFilteredOptions = filteredOptions.map((item) => ({
        name: item.value[tableRef.columns.userName].value,
        value: item.id,
      }));

      const copyTable = JSON.parse(JSON.stringify(filteredOptions));

      const maintenanceAccountChoices = [
        ...mappedFilteredOptions,
        {
          name: 'DEFAULT',
          value: table.find((item) => item.value[tableRef.columns.uploaderFlag].value === '1')?.id,
        },
      ];

      let chosenMaintenanceAccount = maintenanceAccountChoices[0].value;
      if (mappedFilteredOptions.length > 1) {
        console.log('Customers List Found: ');
        console.table(
          copyTable.map((item) => {
            for (const key in item.value) {
              if (Object.hasOwnProperty.call(item.value, key)) {
                item.value[key] = item.value[key].value;

                if (key === 'Password') delete item.value[key];
              }
            }
            return item.value;
          }),
        );

        const maintenanceAccountQuestion = [
          {
            type: 'list',
            name: 'chosenMaintenanceAccount',
            message: 'Select maintenance account:',
            choices: maintenanceAccountChoices,
          },
        ];

        const answersMaintenanceAccount = await prompt(maintenanceAccountQuestion);

        chosenMaintenanceAccount = answersMaintenanceAccount.chosenMaintenanceAccount;
      }

      if (chosenMaintenanceAccount) {
        const chosenAccount = table.find((item) => item.id === chosenMaintenanceAccount);

        configJson.baseUrl = chosenAccount.value[tableRef.columns.url].value;
        configJson.username = chosenAccount.value[tableRef.columns.userName].value;
        configJson.password = chosenAccount.value[tableRef.columns.password].value;
      }
    }

    if (!isAutomaticLookupConfig) {
      const urlQuestion = [
        {
          type: 'input',
          name: 'inputUrl',
          message: 'Input target URL: ',
        },
      ];

      const urlAnswer = await prompt(urlQuestion);

      const {inputUrl} = urlAnswer;

      const maintenanceAccountUserQuestion = [
        {
          type: 'input',
          name: 'inputUser',
          message: 'Input maintenance account: ',
        },
      ];

      const maintenanceAccountUserAnswer = await prompt(maintenanceAccountUserQuestion);

      const {inputUser} = maintenanceAccountUserAnswer;

      const maintenanceAccountPasswordQuestion = [
        {
          type: 'password',
          name: 'inputPassword',
          message: 'Password: ',
        },
      ];

      const maintenanceAccountPasswordAnswer = await prompt(maintenanceAccountPasswordQuestion);

      const {inputPassword} = maintenanceAccountPasswordAnswer;

      configJson.baseUrl = inputUrl;
      configJson.username = inputUser;
      configJson.password = inputPassword;
    }

    const readBasicConfig = JSON.parse(JSON.stringify(configJson));
    const readManifest = JSON.parse(fs.readFileSync('./dest/customize-manifest.json'));

    try {
      const userClient = functions.getClient(readBasicConfig);

      const app = await functions.getApp(userClient, readManifest.app);
      console.log('Related App Found: ');
      console.table({
        app,
      });

      readBasicConfig.appId = readManifest.app;
      readBasicConfig.isEligibleConfig = true;
    } catch (error) {
      readBasicConfig.appId = readManifest.app;
      readBasicConfig.isEligibleConfig = false;
    }

    if (!fs.existsSync('./config')) {
      fs.mkdirSync('./config');
    }

    fs.writeFileSync('./config/basic-config.json', JSON.stringify(readBasicConfig, null, 2), 'utf8', (err, data) => {});

    return;
  }

  if (usedMainArg === 'import') {
    const readBasicConfig = functions.readBasicConfig();

    const isEligibleConfig = readBasicConfig.isEligibleConfig;
    if (!isEligibleConfig) {
      console.error('Config is ineligible. Please re-init config.');
      return;
    }

    functions.callUploader('import');
    return;
  }

  if (usedMainArg === 'boiler') {
    const readBasicConfig = functions.readBasicConfig();
    const userClient = functions.getClient(readBasicConfig);
    const isNew = await functions.checkIsNewCustomization(readBasicConfig, userClient);
    let userTemplateArg = null;

    if (!isNew) console.log('Warning: This app has already had customizations. Please make sure to run import first before uploading.');

    if (restArgs.length) {
      userTemplateArg = restArgs[0];

      functions.processTemplate(userTemplateArg, readBasicConfig, userClient);
      functions.copyCustomizeManifest(userTemplateArg);

      return;
    }

    console.log('Using default template');
    functions.copyCustomizeManifest(userTemplateArg);
    return;
  }

  if (usedMainArg === 'upload') {
    const readBasicConfig = functions.readBasicConfig();
    const userClient = functions.getClient(readBasicConfig);

    const readManifest = JSON.parse(fs.readFileSync('./dest/customize-manifest.json'));

    try {
      const app = await functions.getApp(userClient, readManifest.app);
      console.log('Related App Found: ');
      console.table({
        app,
      });
      console.log('Please make sure this is the correct app.');
    } catch (error) {
      exit();
    }

    const isNew = await functions.checkIsNewCustomization(readBasicConfig, userClient);

    if (!isNew) {
      const confirmationDialogue = [
        {
          type: 'list',
          name: 'confirmed',
          message: 'This app has already had customizations. Please make sure you have imported them before uploading.',
          choices: [
            {
              name: 'Proceed.',
              value: true,
            },
            {
              name: 'Cancel.',
              value: false,
            },
          ],
        },
      ];

      const confirmationAnswer = await prompt(confirmationDialogue);
      const {confirmed} = confirmationAnswer;

      if (!confirmed) return;
    }

    functions.callUploader('upload');
    return;
  }

  if (usedMainArg === 'once') {
    const readBasicConfig = functions.readBasicConfig();
    const userClient = functions.getClient(readBasicConfig);

    const readManifest = JSON.parse(fs.readFileSync('./dest/customize-manifest.json'));

    try {
      const app = await functions.getApp(userClient, readManifest.app);
      console.log('Related App Found: ');
      console.table({
        app,
      });
      console.log('Please make sure this is the correct app.');
    } catch (error) {
      exit();
    }

    functions.callUploader('once');
    return;
  }

  if (usedMainArg === 'setup') {
    console.log('...to setup the project. please enter your credentials down below.');
    const maintenanceAccountUserQuestion = [
      {
        type: 'input',
        name: 'inputUser',
        message: 'User Name: ',
      },
    ];

    const maintenanceAccountUserAnswer = await prompt(maintenanceAccountUserQuestion);

    const {inputUser} = maintenanceAccountUserAnswer;

    const maintenanceAccountPasswordQuestion = [
      {
        type: 'password',
        name: 'inputPassword',
        message: 'Password: ',
      },
    ];

    const maintenanceAccountPasswordAnswer = await prompt(maintenanceAccountPasswordQuestion);

    const {inputPassword} = maintenanceAccountPasswordAnswer;

    const envContent = `HOST=https://aqi.cybozu.com\nUSER=${inputUser}\nPASS=${inputPassword}`;

    fs.writeFileSync(envFilePath, envContent);

    console.log('successfully setup the environment variables.');
    return;
  }

  /** default usage */
  console.log(`
    akcu

    Usage
      $ akcu <params>

    Params
      setup                   setup .env variable by logging in with AQI kintone account
      init                    generate basic-config.json
      import                  import customization files & customize-manifest.json file from remote apps 
      boiler <user-template>  update customization files & customize-manifest.json file
             <user-template>  is optional, default will be boilerplate for cdn(s) only
             ex: boiler kuya  append template with kuya's template.
      upload                  upload customization files to remote apps

    Limitations
      does not support basic auth, OAuth, proxy server, guest space app

    References
      kintone-customize-uploader package: https://github.com/kintone/js-sdk/tree/master/packages/customize-uploader#readme

  `);
})();
