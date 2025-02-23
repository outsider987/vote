export function toBeFormData(data: any, isArrayTokey = false) {
  const formData = new FormData();
  for (const key in data) {
    if (
      data.hasOwnProperty(key) &&
      key !== undefined &&
      key !== null &&
      key !== '[object Object]' &&
      key !== 'null' &&
      key !== ''
    ) {
      if (Array.isArray(data[key]) && isArrayTokey) {
        data[key].forEach((item: any) => {
          if (item !== null && item !== '[object Object]' && item !== 'null') {
            formData.append(key, item);
          }
        });
      } else {
        formData.append(key, data[key]);
      }
    }else{
      // TODO 异常的key 提示
    }
  }
  return formData;
}