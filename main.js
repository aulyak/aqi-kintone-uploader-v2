const inquirer = require('inquirer');
const functions = require('./functions');
const {kintoneApps} = require('./init');

(async () => {
  const prompt = inquirer.createPromptModule();
  const tableRef = kintoneApps.customersListApp.fieldCode.table;
  
  const customerQuestion = [
    {
      type: 'input',
      name: 'customerName',
      message: 'Input customer name:',
      // choices: ['Red', 'Blue', 'Green', 'Yellow']
    }
  ];

  const answersCustomer = await prompt(customerQuestion);
  const {customerName} = answersCustomer;
  const customersList = await functions.getCustomersList(customerName);

  let customer = customersList[0];

  if (customersList.length > 1) {
    const customersOption = [
      {
        type: 'list',
        name: 'chosenCustomer',
        message: 'Select customer:',
        choices: customersList.map(item => ({
          name: item[kintoneApps.customersListApp.fieldCode.customerName].value,
          value: item.$id.value
        }))
      }
    ]

    const answersOption = await prompt(customersOption);
    const {chosenCustomer} = answersOption;
    customer = customersList.find(item => item.$id.value === chosenCustomer);
  }

  const table = customer[tableRef.code].value;
  console.log(customer[kintoneApps.customersListApp.fieldCode.customerName].value);
  const copyTable = JSON.parse(JSON.stringify(table));
  console.table(copyTable.map(item => {
    for (const key in item.value) {
      if (Object.hasOwnProperty.call(item.value, key)) {
        const element = item.value[key];
        
        item.value[key] = item.value[key].value

        if (key === 'Password') delete item.value[key]
      }
    }
    return item.value
  }));
  const maintenanceAccountChoices = table.map(item => ({
    name: item.value[tableRef.columns.userName].value,
    value: item.id
  }));

  const maintenanceAccountQuestion = [
    {
      type: 'list',
      name: 'chosenMaintenanceAccount',
      message: 'Select maintenance account:',
      choices: maintenanceAccountChoices
    }
  ]

  const answersMaintenanceAccount = await prompt(maintenanceAccountQuestion);
  const {chosenMaintenanceAccount} = answersMaintenanceAccount;
  const chosenAccount = table.find(item => item.id === chosenMaintenanceAccount);
  
  console.table({
    'url': chosenAccount.value[tableRef.columns.url].value,
    'Username': chosenAccount.value[tableRef.columns.userName].value,
    'Account Type': chosenAccount.value[tableRef.columns.accountType].value,
  })
})();