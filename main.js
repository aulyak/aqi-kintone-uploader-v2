const inquirer = require('inquirer');
const functions = require('./functions');
const { kintoneApps } = require('./init');
const init = require('./init');

(async () => {
  const prompt = inquirer.createPromptModule();
  const tableRef = kintoneApps.customersListApp.fieldCode.table;

  const args = process.argv.slice(2);
  const usedArg = args[0];

  console.log({ usedArg });

  if (usedArg === 'init') {
    const appIdQuestion = [
      {
        type: 'input',
        name: 'appId',
        message: 'Input App ID:',
      },
    ];

    const answersAppId = await prompt(appIdQuestion);
    const { appId } = answersAppId;
    init.configJson.appId = appId;

    const selectCustomerOptions = [
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
            name: "No. I'll input it manually.",
            value: false,
          },
        ],
      },
    ];

    const answersSelectCustomerOptions = await prompt(selectCustomerOptions);
    const { isAutomaticLookupConfig } = answersSelectCustomerOptions;

    if (isAutomaticLookupConfig) {
      const customerQuestion = [
        {
          type: 'input',
          name: 'customerName',
          message: 'Input customer name:',
        },
      ];

      let customersList = [];

      while (!customersList.length) {
        const answersCustomer = await prompt(customerQuestion);
        const { customerName } = answersCustomer;
        customersList = await functions.getCustomersList(customerName);

        if (!customersList.length)
          console.log('No customer found. please refine your search.');
      }

      let customer = customersList[0];

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

      const answersOption = await prompt(customersOption);
      const { chosenCustomer } = answersOption;
      customer = customersList.find(
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
              const element = item.value[key];

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
        {
          name: 'MANUAL OVERRIDE',
          value: null,
        },
      ];

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
      const { chosenMaintenanceAccount } = answersMaintenanceAccount;

      if (chosenMaintenanceAccount) {
        const chosenAccount = table.find(
          (item) => item.id === chosenMaintenanceAccount,
        );

        init.configJson.url = chosenAccount.value[tableRef.columns.url].value;
        init.configJson.user =
          chosenAccount.value[tableRef.columns.userName].value;
        init.configJson.password =
          chosenAccount.value[tableRef.columns.password].value;

        console.table({
          config: init.configJson,
        });
      }
    }

    if (!isAutomaticLookupConfig) {
    }
  }
})();
