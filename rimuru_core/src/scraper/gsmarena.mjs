import gsmarena from "gsmarena-api";

async function search(query) {
  return gsmarena.search.search(query);
}

async function detail(deviceId) {
  return gsmarena.catalog.getDevice(deviceId);
}

async function brands() {
  return gsmarena.catalog.getBrands();
}

async function brandDevices(brandId) {
  return gsmarena.catalog.getBrand(brandId);
}

export { search, detail, brands, brandDevices };
