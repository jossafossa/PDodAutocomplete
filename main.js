import PDocAutocomplete from "./PDocAutocomplete";
import "./style.scss";

let input = document.getElementById("autocomplete");
let autocomplete = new PDocAutocomplete(input);

let postal = document.querySelector("[name=postal]");
let city = document.querySelector("[name=city]");
let street = document.querySelector("[name=street]");
let country = document.querySelector("[name=country]");
let number = document.querySelector("[name=number]");
let lat = document.querySelector("[name=lat]");
let lng = document.querySelector("[name=lng]");

const setValues = (address) => {
  postal.value = address?.postcode || "";
  city.value = address?.woonplaatsnaam || "";
  street.value = address?.straatnaam || "";
  country.value = address?.country || "";
  number.value = address?.huis_nlt || "";
  lat.value = address?.lat || "";
  lng.value = address?.lng || "";
};

autocomplete.on("select", (address) => {
  setValues(address);
});

autocomplete.on("unselect", () => {
  console.log("unselect");
  setValues();
});

autocomplete.on("error", (error) => {
  console.error(error);
});
