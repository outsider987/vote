export function toBeFormData(data: any, isArrayTokey = false) {
  const formData = new FormData();
  for (const key in data) {
    if (
      data.hasOwnProperty(key) &&
      key !== undefined &&
      key !== null &&
      key !== "[object Object]" &&
      key !== "null" &&
      key !== ""
    ) {
      if (Array.isArray(data[key]) && isArrayTokey) {
        data[key].forEach((item: any) => {
          if (item !== null && item !== "[object Object]" && item !== "null") {
            // Convert objects to JSON strings before appending
            formData.append(key, typeof item === "object" ? JSON.stringify(item) : item);
          }
        });
      } else {
        // Convert objects to JSON strings if necessary
        formData.append(key, typeof data[key] === "object" ? JSON.stringify(data[key]) : data[key]);
      }
    } else {
      console.warn(`Invalid key detected: ${key}`);
    }
  }
  return formData;
}
