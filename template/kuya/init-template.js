/* eslint-disable no-undef */
const init = {
  app: {
    thisApp: {
      id: kintone.app.getId(),
      token: '',
      fieldCode: {

      },
      event: {
        indexShow: () => [
          'app.record.index.show'
        ],
        createEditShow: () => [
          'app.record.create.show',
          'app.record.edit.show',
        ],
        detailShow: () => [
          `app.record.detail.show`,
        ],
        submit: () => [
          `app.record.create.submit`,
          `app.record.edit.submit`,
        ],
        submitSuccess: () => [
          `app.record.create.submit.success`,
          `app.record.edit.submit.success`,
        ],
      },
    },
  },
  lib: {
    client: apiToken => {
      const opt = apiToken ?
        {
          auth: {
            apiToken
          }
        } :
        {};

      return new KintoneRestAPIClient(opt);
    },
    Swal,
    Kuc: Kuc,
    dt: luxon.DateTime,
  },
  globalVars: {
  },
};