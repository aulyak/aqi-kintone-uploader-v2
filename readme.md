# Get Started

To get started with the AQI Kintone Uploader V2, follow the steps below:

## Command

- ### akcu setup

  Use this command to set up your AQI Kintone account by adding the necessary environment variables. This will allow you to access the AQI Kintone customers list.

- ### akcu init

  This command initializes a kintone project in your current directory. You will be prompted to enter your app ID, scope, and customer name. If you have multiple accounts, you can select the maintenance account.

- ### akcu import

  Use this command to import the current code and project setup into a local file.

- ### akcu upload

  This command uploads your code to the project app.

- ### akcu boiler

  Use this command to get the default template of the project folder structure, which includes the customize-manifest.js file with default CDN packages. You can add a custom file by specifying it after "akcu boiler". For example, to get a custom file named "kuya", use the command "akcu boiler kuya".

Make sure to follow these steps to effectively use the AQI Kintone Uploader V2.

## Limitations

Please be aware of the following limitations when using the AQI Kintone Uploader V2:

- The AQI Kintone Uploader V2 currently only supports uploading code to non-guest space apps.

- The AQI Kintone Uploader V2 currently only supports user authentications.

- The AQI Kintone Uploader V2 currently does not support proxy

Please keep these limitations in mind while using the AQI Kintone Uploader V2. Use kintone-customize-uploader instead for mentioned cases.
