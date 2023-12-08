import inquirer from 'inquirer';
import {functions} from './functions.js';
import {kintoneApps, configJson} from './init.js';
import fs from 'fs';
import process from 'process';
import {execSync} from 'child_process';
import {fileURLToPath} from 'url';
import {dirname, resolve} from 'path';

// eslint-disable-next-line max-statements
(async () => {
  console.log('ctrl + C to exit program at anytime.');

  const prompt = inquirer.createPromptModule();
  const tableRef = kintoneApps.customersListApp.fieldCode.table;

  const args = process.argv.slice(2);
  const usedArg = args[0];
  const restArgs = [...args].splice(1);

  if (usedArg === 'init') {
    const appIdQuestion = [
      {
        type: 'input',
        name: 'appId',
        message: 'Input App ID:',
      },
    ];

    const answersAppId = await prompt(appIdQuestion);
    const {appId} = answersAppId;
    configJson.appId = appId;

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

        if (!customersList.length) {
          console.log('No customer found. please refine your search.');
        }
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

    console.table({
      config: showConfig,
    });

    if (!fs.existsSync('./config')) {
      fs.mkdirSync('./config');
    }

    fs.writeFileSync(
      './config/base.json',
      JSON.stringify(configJson),
      'utf8',
      (err, data) => {},
    );

    const readConfig = JSON.parse(fs.readFileSync('./config/base.json'));
    const userClient = functions.getClient(readConfig);

    const app = await functions.getApp(userClient, readConfig.appId);

    console.table({
      app
    });
  }

  if (usedArg === 'import') {
    // // Replace 'kintone-customize-uploader' with the actual name of the module you want to run
    // const moduleName = '@kintone/customize-uploader';

    // // Get the absolute path of the current module's file
    // const currentFileUrl = import.meta.url;
    // const currentFilePath = fileURLToPath(currentFileUrl);

    // // Get the directory of the current module
    // const currentDirectory = dirname(currentFilePath);

    // // Resolve the path of the module relative to the current module's directory
    // const modulePath = resolve(currentDirectory, 'node_modules', moduleName, 'bin', 'cli.js');

    // // Replace backslashes with double backslashes for Windows
    // const modulePathForWindows = modulePath.replace(/\\/g, '\\\\');

    // console.log(`Executing command: node ${modulePathForWindows} --version`);

    // // Run the kintone-customize-uploader module directly in the console
    // try {
    //   execSync(`node ${modulePathForWindows} --version`, {stdio: 'inherit'});
    //   console.log('Command executed successfully.');
    // } catch (error) {
    //   console.error(`Error running kintone-customize-uploader: ${error.message}`);
    // }

    // Replace 'kintone-customize-uploader' with the actual name of the module you want to run
    const moduleName = '@kintone/customize-uploader';

    const currentFileUrl = import.meta.url;
    const currentFilePath = fileURLToPath(currentFileUrl);
    const currentDirectory = dirname(currentFilePath);

    try {
      // Resolve the path of the module and extract the directory
      // const modulePath = resolve(currentDirectory, 'node_modules', moduleName, 'dist', 'cli.js');

      // console.log(`Executing command: node ${modulePath} --version`);

      // Run the kintone-customize-uploader module directly in the console
      // execSync(`node ${modulePath} --version`, {stdio: 'inherit'});
      execSync(`node .\\node_modules\\@kintone\\customize-uploader\\dist\\cli.js --version`, {stdio: 'inherit'});

      console.log('Command executed successfully.');
    } catch (error) {
      console.error(`Error running kintone-customize-uploader: ${error.message}`);
    }
  }
})();
