/** @module functions */

import fs from 'fs';
import path from 'path';
import {fileURLToPath} from 'url';
import {execSync} from 'child_process';
import {createSpinner} from 'nanospinner';
import pkg from 'lodash';
import {KintoneRestAPIClient} from '@kintone/rest-api-client';
import {kintoneApps} from './init.js';

const {_} = pkg;

const currentScriptPath = fileURLToPath(import.meta.url);

const functions = {
  /**
   * to determine whether the current customized app has existing customizations or not.
   * if it returns true, then the app has no existing customization.
   *
   * @memberof functions
   * @param {object} readBasicConfig - basic config read from file ./config/basic-config.json
   * @param {object} userClient - userClient object instantiated with selected user to make API call
   * @returns {boolean} - true or falsy value of whether the app has already customization
   */
  checkIsNewCustomization: async (readBasicConfig, userClient) => {
    const appCustomize = await userClient.app.getAppCustomize({
      app: readBasicConfig.appId
    });

    const normalizedCustomizeInfo = JSON.parse(JSON.stringify(appCustomize));

    let isNew = true;
    loop1:
    for (const env in normalizedCustomizeInfo) {
      if (Object.hasOwnProperty.call(normalizedCustomizeInfo, env)) {
        if (env === 'scope' || env === 'revision') continue;
        const element = normalizedCustomizeInfo[env];
        for (const type in element) {
          if (Object.hasOwnProperty.call(element, type)) {
            // eslint-disable-next-line max-depth
            if (element[type].length) {
              isNew = false;
              break loop1;
            }
          }
        }
      }
    }

    return isNew;
  },
  /**
   * to initiate and show spinner
   *
   * @param {object} opt - {text, color} text and color for spinner
   * @returns {object} spinner instance
   */
  showSpinner: (opt) => {
    const spinner = createSpinner();

    spinner.start(opt);

    return spinner;
  },
  /**
   * to stop spinner based on success or error
   *
   * @param {object} spinner - spinner instance returned from showSpinner()
   * @param {string} msg - text message to be displayed after spinner is stopped
   * @param {boolean} [isSuccess = true] - determine success or error
   */
  stopSpinner: (spinner, msg, isSuccess = true) => {
    const method = isSuccess ? 'success' : 'error';
    spinner[method]({
      text: `${method.toUpperCase()} ${msg}`
    });
  },
  /**
   * to get KintoneRestAPIClient based on created config
   *
   * @param {object} params - {baseUrl, username, password} or basic config read from ./config/basic-config.json
   * @returns {object} KintoneRestAPIClient instance
   */
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
  /**
   * get list of customer from Kintone Customer List on https://aqi.cybozu.com by customer name (operator: contains)
   *
   * @param {string} customerName - the name of customer to be looked up
   * @param {object} masterClient - KintoneRestAPIClient instance generated from .env
   * @returns {object} - list of customer if success,
   * @throws error if any error occurred
   */
  getCustomersList: (customerName, masterClient) => {
    const text = 'Getting Customers List.';
    const spinner = functions.showSpinner({
      text,
      color: 'yellow',
    });

    const condition = `${kintoneApps.customersListApp.fieldCode.customerName} like "${customerName}"`;
    return masterClient.record.getAllRecords({
      app: kintoneApps.customersListApp.id,
      condition,
    }).then((resp) => {
      if (!resp.length) {
        console.log('No customer found. please refine your search.');
        functions.stopSpinner(spinner, text, false);

        return resp;
      }

      functions.stopSpinner(spinner, text);

      return resp;
    }).catch(error => {
      const {message, id, code} = error;

      functions.stopSpinner(spinner, text, false);

      const errMsg = {
        error: {
          message,
          id,
          code,
          note: 'Wrong environment variables. Please setup the .env file correctly. Make sure you set the correct domain and credentials.'
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
  /**
   * to get app info (id and name)
   *
   * @param {object} userClient - KintoneRestAPIClient instance generated basic config
   * @param {(string|number)} appId - the appId from basic config
   * @returns {object} - {appId, name} app id and name of the app if success
   * @throws error if any error occurred
   */
  getApp: (userClient, appId) => {
    const text = 'Getting Related App.';
    const spinner = functions.showSpinner({
      text,
      color: 'yellow',
    });

    return userClient.app.getApp({
      id: appId,
    }).then(resp => {
      functions.stopSpinner(spinner, text);

      return {
        appId: resp.appId,
        name: resp.name,
      };
    }).catch(error => {
      const {message, id, code} = error;

      functions.stopSpinner(spinner, text, false);

      const errMsg = {
        error: {
          message,
          id,
          code,
          note: 'Wrong config. Please re-init the config with correct information. Make sure the DOMAIN, APP, AND USER match and are eligible.'
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
  /**
   * execute kintone-customize-uploader package based on config and type
   *
   * @param {string} type - the type of argument passed to kintone-customize-uploader package
   */
  callUploader: (type) => {
    const uploaderCliPath = path.join(path.dirname(currentScriptPath), '.', '.\\node_modules\\@kintone\\customize-uploader\\bin\\cli.js');

    let args = '';

    if (type === 'init') {
      args += 'init';
    }

    if (type === 'import' || type === 'upload') {
      const readConfig = JSON.parse(fs.readFileSync('./config/basic-config.json'));
      const {baseUrl, username, password} = readConfig;

      if (type === 'import') {
        args += `import dest\\customize-manifest.json --base-url ${baseUrl} --username ${username} --password ${password}`;
      }

      if (type === 'upload') {
        args += `--watch dest\\customize-manifest.json --base-url ${baseUrl} --username ${username} --password ${password}`;
      }

    }

    const cliPath = `${uploaderCliPath} ${args}`;

    try {
      execSync(`node ${cliPath}`, {stdio: 'inherit'});
    } catch (error) {
      console.error(`Error running kintone-customize-uploader: ${error.message}`);
    }
  },
  copyCustomizeManifest: (userTemplate) => {
    const customizeManifestPath = path.join(
      path.dirname(currentScriptPath), '.', `./template/${userTemplate ? userTemplate + '/' : ''}customize-manifest-template.json`
    );
    const customizeManifest = fs.readFileSync(customizeManifestPath, 'utf8');
    const customizeManifestJson = JSON.parse(customizeManifest);
    const realManifest = fs.readFileSync(`./dest/customize-manifest.json`, 'utf8');
    const realManifestJson = JSON.parse(realManifest);

    realManifestJson.scope = customizeManifestJson.scope;
    realManifestJson.desktop.js = Array.from(new Set(
      [
        ...customizeManifestJson.desktop.js,
        ...realManifestJson.desktop.js,
      ]
    ));
    realManifestJson.desktop.css = Array.from(new Set(
      [
        ...customizeManifestJson.desktop.css,
        ...realManifestJson.desktop.css,
      ]
    ));
    realManifestJson.mobile.js = Array.from(new Set(
      [
        ...customizeManifestJson.mobile.js,
        ...realManifestJson.mobile.js,
      ]
    ));
    realManifestJson.mobile.css = Array.from(new Set(
      [
        ...customizeManifestJson.mobile.css,
        ...realManifestJson.mobile.css,
      ]
    ));

    fs.writeFileSync(
      './dest/customize-manifest.json',
      JSON.stringify(realManifestJson, null, 2),
      'utf8',
      (err, data) => {},
    );

    console.log('Completed copying from template.');
  },
  readBasicConfig: () => {
    try {
      return JSON.parse(fs.readFileSync('./config/basic-config.json'));
    } catch {
      throw new Error('No basic config found. Please re-init app.');
    }
  },
  processTemplate: async (userTemplateArg, readBasicConfig, userClient) => {
    if (userTemplateArg === 'kuya') {

      const codeInit = fs.readFileSync(path.join(
        path.dirname(currentScriptPath), '.', `./template/${userTemplateArg ? userTemplateArg + '/' : ''}init-template.js`
      ), 'utf8');
      const codeFunctions = fs.readFileSync(path.join(
        path.dirname(currentScriptPath), '.', `./template/${userTemplateArg ? userTemplateArg + '/' : ''}functions-template.js`
      ), 'utf8');
      const codeMain = fs.readFileSync(path.join(
        path.dirname(currentScriptPath), '.', `./template/${userTemplateArg ? userTemplateArg + '/' : ''}main-template.js`
      ), 'utf8');

      const substr = codeInit.substring(codeInit.indexOf('fieldCode'));
      const substrFieldCode = substr.substring(substr.indexOf('{'), substr.indexOf('}') + 1);

      const formFields = await userClient.app.getFormFields({
        app: readBasicConfig.appId
      });

      const fields = formFields.properties;
      const fieldCode = functions.getAutomatedFieldCode(fields);

      const resultInit = codeInit.replace(substrFieldCode, JSON.stringify(fieldCode, null, 2));

      fs.writeFileSync(
        './dest/desktop/js/init.js',
        resultInit,
        'utf8',
        (err, data) => {},
      );

      fs.writeFileSync(
        './dest/desktop/js/functions.js',
        codeFunctions,
        'utf8',
        (err, data) => {},
      );

      fs.writeFileSync(
        './dest/desktop/js/main.js',
        codeMain,
        'utf8',
        (err, data) => {},
      );

      return;
    }

    throw new Error(`No Config Found for user ${userTemplateArg}`);
  },
  getAutomatedFieldCode: (fields) => {
    const fieldCode = {};
    const labelCounter = {};
    for (const field in fields) {
      if (Object.hasOwnProperty.call(fields, field)) {
        const val = fields[field];
        let label = val.label;
        if (Object.hasOwnProperty.call(labelCounter, label)) {
          labelCounter[label]++;
        } else {
          labelCounter[label] = 0;
        }

        if (Object.hasOwnProperty.call(fieldCode, _.camelCase(label))) {
          label += labelCounter[label];
        }

        if (val.type === 'SUBTABLE') {
          if (Object.hasOwnProperty.call(fieldCode, 'table')) {
            fieldCode.table[_.camelCase(label)] = {
              fieldCode: val.code,
              columns: {},
            };
          } else {
            fieldCode.table = {
              [_.camelCase(label)]: {
                fieldCode: val.code,
                columns: {},
              }
            };
          }

          const row = val.fields;
          for (const column in row) {
            if (Object.hasOwnProperty.call(row, column)) {
              const thisCol = row[column];
              let colLabel = thisCol.label;
              if (Object.hasOwnProperty.call(labelCounter, colLabel)) {
                labelCounter[colLabel]++;
              } else {
                labelCounter[colLabel] = 0;
              }

              if (Object.hasOwnProperty.call(fieldCode.table[_.camelCase(label)].columns, _.camelCase(colLabel))) {
                colLabel += labelCounter[colLabel];
              }

              fieldCode.table[_.camelCase(label)].columns[_.camelCase(colLabel)] = thisCol.code;
            }
          }


        } else {

          fieldCode[_.camelCase(label)] = val.code;
        }
      }
    }

    return fieldCode;
  }
};

export {
  /**
   * @object
   */
  functions
};