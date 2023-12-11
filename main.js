/* eslint-disable max-depth */
import inquirer from 'inquirer';
import {functions} from './functions.js';
import {kintoneApps, configJson} from './init.js';
import fs from 'fs';
import process from 'process';
import util from 'util';
import pkg from 'lodash';
const {_} = pkg;

// eslint-disable-next-line max-statements
(async () => {
  console.log('ctrl + C to exit program at anytime.');

  const prompt = inquirer.createPromptModule();
  const tableRef = kintoneApps.customersListApp.fieldCode.table;

  const args = process.argv.slice(2);
  const usedMainArg = args[0];
  const restArgs = [...args].splice(1);

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
            name: 'No. I\'ll input it manually. (recommended for internal use)',
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
        customersList = await functions.getCustomersList(customerName);
      }

      const customersOption = [
        {
          type: 'list',
          name: 'chosenCustomer',
          message: 'Select customer:',
          choices: customersList.map((item) => ({
            name: item[kintoneApps.customersListApp.fieldCode.customerName]
              .value,
            value: item.$id.value,
          })),
        },
      ];

      let chosenCustomer = customersOption[0].choices[0].value;

      if (customersList.length > 1) {
        const answersOption = await prompt(customersOption);
        chosenCustomer = answersOption.chosenCustomer;
      }

      const customer = customersList.find(
        (item) => item.$id.value === chosenCustomer,
      );

      const table = customer[tableRef.code].value;

      const filteredOptions = table.filter(
        (item) =>
          item.value[tableRef.columns.accountType].value ===
          'Kintone Maintenance Account',
      );

      const mappedFilteredOptions = filteredOptions.map((item) => ({
        name: item.value[tableRef.columns.userName].value,
        value: item.id,
      }));

      const copyTable = JSON.parse(JSON.stringify(filteredOptions));

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

      const maintenanceAccountChoices = [
        ...mappedFilteredOptions,
        {
          name: 'DEFAULT',
          value: table.find(
            (item) => item.value[tableRef.columns.uploaderFlag].value === '1',
          )?.id,
        },
      ];

      let chosenMaintenanceAccount = maintenanceAccountChoices[0].value;
      if (mappedFilteredOptions.length > 1) {
        const maintenanceAccountQuestion = [
          {
            type: 'list',
            name: 'chosenMaintenanceAccount',
            message: 'Select maintenance account:',
            choices: maintenanceAccountChoices,
          },
        ];

        const answersMaintenanceAccount = await prompt(
          maintenanceAccountQuestion,
        );

        chosenMaintenanceAccount = answersMaintenanceAccount.chosenMaintenanceAccount;
      }

      if (chosenMaintenanceAccount) {
        const chosenAccount = table.find(
          (item) => item.id === chosenMaintenanceAccount,
        );

        configJson.baseUrl = chosenAccount.value[tableRef.columns.url].value;
        configJson.username =
          chosenAccount.value[tableRef.columns.userName].value;
        configJson.password =
          chosenAccount.value[tableRef.columns.password].value;
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

      const maintenanceAccountUserAnswer = await prompt(
        maintenanceAccountUserQuestion,
      );

      const {inputUser} = maintenanceAccountUserAnswer;

      const maintenanceAccountPasswordQuestion = [
        {
          type: 'password',
          name: 'inputPassword',
          message: 'Password: ',
        },
      ];

      const maintenanceAccountPasswordAnswer = await prompt(
        maintenanceAccountPasswordQuestion,
      );

      const {inputPassword} = maintenanceAccountPasswordAnswer;

      configJson.baseUrl = inputUrl;
      configJson.username = inputUser;
      configJson.password = inputPassword;
    }

    const showConfig = JSON.parse(JSON.stringify(configJson));
    showConfig.password = '########';

    const readConfig = JSON.parse(JSON.stringify(configJson));
    const readManifest = JSON.parse(fs.readFileSync('./dest/customize-manifest.json'));

    try {
      const userClient = functions.getClient(readConfig);

      const app = await functions.getApp(userClient, readManifest.app);
      console.log('Related App Found: ');
      console.table({
        app
      });

      readConfig.appId = readManifest.app;
      readConfig.isEligibleConfig = true;

      if (!fs.existsSync('./config')) {
        fs.mkdirSync('./config');
      }
    } catch (error) {
      readConfig.appId = readManifest.app;
      readConfig.isEligibleConfig = false;
    }

    fs.writeFileSync(
      './config/basic-config.json',
      JSON.stringify(readConfig),
      'utf8',
      (err, data) => {},
    );

    console.log('Saved Config: ');
    console.table({
      config: readConfig,
    });
  }

  if (usedMainArg === 'import') {
    const readConfig = JSON.parse(fs.readFileSync('./config/basic-config.json'));
    const readManifest = JSON.parse(fs.readFileSync('./dest/customize-manifest.json'));

    console.log({readConfig});
    console.log({readManifest});

    const isEligibleConfig = readConfig.isEligibleConfig;
    if (!isEligibleConfig) {
      console.error('Config is ineligible. Please re-init config.');
      return;
    }

    functions.callUploader('import');
  }

  if (usedMainArg === 'boilerplate') {
    console.log({restArgs});

    if (restArgs[0] === '--new') {
      const readConfig = JSON.parse(fs.readFileSync('./config/basic-config.json'));
      const readManifest = JSON.parse(fs.readFileSync('./dest/customize-manifest.json'));

      const userClient = functions.getClient(readConfig);

      const appCustomize = await userClient.app.getAppCustomize({
        app: readConfig.appId
      });

      const normalizedCustomizeInfo = JSON.parse(JSON.stringify(appCustomize));
      // console.log(util.inspect(readManifest, false, null, true /* enable colors */), 'readManifest');

      let isNew = true;
      loop1:
      for (const env in normalizedCustomizeInfo) {
        if (Object.hasOwnProperty.call(normalizedCustomizeInfo, env)) {
          if (env === 'scope' || env === 'revision') continue;
          const element = normalizedCustomizeInfo[env];
          for (const type in element) {
            if (Object.hasOwnProperty.call(element, type)) {
              if (element[type].length) {
                isNew = false;
                break loop1;
              }
            }
          }
        }
      }

      if (isNew) {
        //
        const codeInit = fs.readFileSync('./template/init-template.js', 'utf8');
        console.log({codeInit});

        const substr = codeInit.substring(codeInit.indexOf('fieldCode'));
        const substrFieldCode = substr.substring(substr.indexOf('{'), substr.indexOf('}') + 1);
        console.log({substrFieldCode});

        const formFields = await userClient.app.getFormFields({
          app: readConfig.appId
        });
        console.log(util.inspect(formFields, false, null, true /* enable colors */));

        const fields = formFields.properties;

        const fieldCode = {

        };
        for (const field in fields) {
          if (Object.hasOwnProperty.call(fields, field)) {
            const val = fields[field];

            if (val.type === 'SUBTABLE') {
              //
              fieldCode.table[_.camelCase(val.label)] = {
                fieldCode: val.code,
                columns: {},

              };

              // const row = val.fields;

              // for (const column in row) {
              //   if (Object.hasOwnProperty.call(row, column)) {
              //     const thisCol = row[column];
              //     console.log({thisCol});

              //     fieldCode.table = {
              //       [_.camelCase(val.label)]: {
              //         columns: {
              //           [_.camelCase(thisCol.label)]: thisCol.code
              //         }
              //       }
              //     };
              //   }
              // }


            } else {
              fieldCode[_.camelCase(val.label)] = val.code;
            }

          }
        }
        console.log(util.inspect(fieldCode, false, null, true /* enable colors */));

        // const final = code.replace(substrFieldCode, 'ASU');
        // console.log({final});
      }
    }

    if (restArgs[0] === '--update') {
      const readConfig = JSON.parse(fs.readFileSync('./config/basic-config.json'));
      const readManifest = JSON.parse(fs.readFileSync('./dest/customize-manifest.json'));

      const userClient = functions.getClient(readConfig);

      const appCustomize = await userClient.app.getAppCustomize({
        app: readConfig.appId
      });

      const normalizedCustomizeInfo = JSON.parse(JSON.stringify(appCustomize));
      console.log(util.inspect(readManifest, false, null, true /* enable colors */), 'readManifest');

      for (const env in normalizedCustomizeInfo) {
        if (Object.hasOwnProperty.call(normalizedCustomizeInfo, env)) {
          if (env === 'scope' || env === 'revision') continue;
          const element = normalizedCustomizeInfo[env];
          for (const type in element) {
            if (Object.hasOwnProperty.call(element, type)) {
              element[type] = element[type].map(item => {
                if (item.type === 'URL') {
                  return item.url;
                }

                if (item.type === 'FILE') {
                  return item.file.name;
                }

                return null;
              });
            }
          }
        }
      }

      console.log(util.inspect(normalizedCustomizeInfo, false, null, true /* enable colors */), 'normalized');
    }
  }
})();
