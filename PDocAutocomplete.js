import { EventHandler } from "./EventHandler";

/**
 * PDokAddress
 * @param {string} address.street - the street name
 * @param {string} address.housenumber - the house number
 * @param {string} address.postcode - the postal code
 * @param {string} address.city - the city
 * @param {string} address.formatted - the formatted address
 * @returns {Object} the address object
 */
function PDokAddress({ street, housenumber, postal, city, formatted }) {
  return {
    street,
    housenumber,
    postal,
    city,
    formatted,
  };
}

/**
 * PDokResults
 * Handles the rendering of the results
 */
class PDokResults extends EventHandler {
  /**
   * Create a new PDokResults
   * @param {HTMLElement} input - the input element to attach the results to
   * @returns {Object} the PDokResults object
   */
  constructor(input) {
    super();

    // set root
    this.root = input;
    this.id = `pdok-${Math.random().toString(36).substr(2, 9)}`;
    this.root.dataset.pdokInput = this.id;

    // on up down key
    this.root.addEventListener("keydown", (e) => {
      // prevent default on arrow up, arrow down and enter
      if (["ArrowUp", "ArrowDown", "Enter"].includes(e.key)) {
        e.preventDefault();
      }

      // move selection down on arrow down
      if (e.key === "ArrowDown") {
        this.moveSelection(1);
      }

      // move selection up on arrow up
      if (e.key === "ArrowUp") {
        this.moveSelection(-1);
      }

      // fill input on enter
      if (e.key === "Enter") {
        this.fillInput(this.selected);
      }
    });

    this.appendStyles();
  }

  check() {
    this.root.blur();
    this.root.dataset.pdokStatus = "check";
  }

  uncheck() {
    delete this.root.dataset.pdokStatus;
  }

  warn(warning) {
    this.root.blur();
    this.root.dataset.pdokStatus = "warn";
    this.root.dataset.pdokMessage = warning;
    console.warn(warning);
  }

  move(input) {
    let box = input.getBoundingClientRect();

    this.results.style.top = `${Math.floor(box.bottom + window.scrollY)}px`;
    this.results.style.left = `${Math.floor(box.left)}px`;
    this.results.style.width = `${box.width}px`;
  }

  /**
   * Move the selection up or down
   * @param {number} step - the step to move
   * @returns void
   */
  moveSelection(step) {
    // get items
    let items = this.results?.querySelectorAll("li");

    // if no items, return
    if (!items) return;

    // set selected
    this.selected = this.selected || 0;

    // move selection and keep it between 0 and items.length
    this.selected = Math.min(
      Math.max(this.selected + step, 0),
      items.length - 1
    );

    // remove selected class from all items
    items.forEach((item) => {
      item.classList.remove("is-selected");
    });

    // ensure the selected is in view
    items[this.selected].scrollIntoView({
      block: "nearest",
    });

    // add selected class to selected
    items[this.selected].classList.add("is-selected");
  }

  /**
   * Fill the input with the address data.
   * Also sets the cursor to the end of the input
   * @param {Object} data - the address data
   * @returns void
   */
  fillInput(index) {
    // when there are options and index is not set, set it to 0
    if (index === -1 || (index === -1 && this.data.length > 0)) index = 0;

    // when this.data is empty, return
    if (this.data.length === 0) return;

    // this.root.value = this.data[index].address.formatted;
    this.emit("select", this.data[index]);

    // fire input event
    let event = new Event("input", { bubbles: true });
    this.root.dispatchEvent(event);

    // set cursor to end of input
    this.root.focus();
  }

  render(data) {
    this.data = data;
    this.selected = -1;

    // remove old results
    this.results?.remove();
    this.results = document.createElement("ul");
    this.results.classList.add("pdok-results");
    this.results.style.width = this.root.offsetWidth + "px";
    this.results.dataset.pdokResults = this.id;

    // render new results
    for (let [index, result] of Object.entries(data)) {
      // create item
      let item = document.createElement("li");

      // set item content
      if (this.showHighlight) {
        item.innerHTML = result.highlight;
      } else {
        item.innerHTML = result.address.formatted;
      }
      // bind click event to fill input
      item.addEventListener("pointerdown", () => this.fillInput(index));

      // append item to results
      this.results.append(item);
    }

    // append results to root
    document.body.append(this.results);

    this.move(this.root);
  }

  appendStyles() {
    let style = document.createElement("style");
    style.innerHTML = `
    body:has([data-pdok-input="${this.id}"]:focus) [data-pdok-results="${this.id}"] {
      display:block;
    }
    `;
    document.head.append(style);
  }
}

/**
 * PDokAutocomplete
 * Use the PDOK locatieserver to autocomplete addresses
 */
export default class PDokAutocomplete extends EventHandler {
  // API root
  apiRoot = "https://api.pdok.nl/bzk/locatieserver/search/v3_1";

  /**
   * create a new PDokAutocomplete
   * @param {HTMLElement} root - the input element to attach the autocomplete to
   */
  constructor(root) {
    super();

    // set settings
    this.root = root;
    this.results = new PDokResults(root);

    this.results.on("select", async (data) => this.onSelect(data));

    // add event listeners
    this.root.addEventListener("input", (e) => this.input(e));
  }

  async onSelect(data) {
    this.root.value = data.address.formatted;

    if (data.type !== "adres") return;

    // has all values
    let isValid = Object.values(data.address).filter(Boolean).length >= 4;

    // filter out empty and undefined values
    if (isValid) {
      const info = await this.getInfo(data.address.formatted);
      this.root.value = info.address.formatted;

      this.results.check();
      this.checked = true;

      if (info.address.formatted !== data.address.formatted) {
        this.results.warn(
          "Het geselecteerde adres is niet hetzelfde als het gevonden adres"
        );
      }
      if (info?.warning) this.results.warn(info.warning);
      this.emit("select", info);
    }

    // when type is address but is not valid
    if (!isValid) {
      this.emit("error", data);
    }
  }

  async getSuggestions(value) {
    // do request
    let data = await this.doRequest("suggest", {
      q: value,
      fq: "type:(woonplaats OR weg OR postcode OR adres)",
      fq: "bron:BAG",
      rows: 30,
    });

    // format results
    data = this.formatResults(data);

    return data;
  }

  async getInfo(q) {
    // do request
    let data = await this.doRequest("free", { q });

    // format results
    data = this.formatInfo(data);

    return data;
  }

  async getInfoByID(id) {
    // do request
    let data = await this.doRequest("lookup", { id });

    // format results
    data = this.formatInfo(data);

    return data;
  }

  /**
   * onInput
   * @description handle input event
   * @param {*} event
   * @returns void
   */
  async input(event) {
    // reset check
    this.results.uncheck();
    if (this?.checked) {
      this.emit("unselect");
      this.checked = false;
    }

    // get value
    const value = event.target.value;

    // if empty, render empty results
    if (value.length === 0) {
      this.results.render([]);
      return;
    }

    // get suggestions
    let data = await this.getSuggestions(value);

    // render results
    this.results.render(data);
  }

  /**
   * Takes an address object and formats it to a string
   * @param {PDokAddress} address - the address object
   * @returns {string} the formatted address
   */
  formatAddress(address) {
    let postalCity = [address.city].filter(Boolean).join(" ");
    let streetHousenumber = [address.street, address.housenumber]
      .filter(Boolean)
      .join(" ");
    let formatted = [postalCity, streetHousenumber].join(", ").trim();

    // if we do not have a house number add spacing
    if (!address.housenumber) {
      formatted = `${formatted} `;
    }

    return formatted;
  }

  /**
   * Takes a record from the PDOK locatieserver and infers the address fields
   * @param {Object} record - the record from the PDOK locatieserver
   * @returns {PDokAddress} the inferred address
   */
  inferAddress(record) {
    // initialize variables
    let city, street, postal, housenumber, postalCity, streetHousenumber;
    let name = record.weergavenaam;

    // infer street fields
    if (record.type === "weg") {
      [street, city] = name.split(",");
    }

    // infer postal fields
    if (record.type === "postcode") {
      [street, postalCity] = name.split(",");
    }

    // infer address fields
    if (record.type === "adres") {
      [streetHousenumber, postalCity] = name.split(",");
    }

    // infer city fields
    if (record.type === "woonplaats") {
      [city] = name.split(",");
    }

    // split up postal and city
    if (postalCity) {
      postalCity = postalCity.trim().split(" ");

      // if the first part begins with a number, it's the postal code
      if (postalCity[0].match(/^\d/)) {
        postal = postalCity.shift();
      }

      // the rest is the city
      city = postalCity.join(" ");
    }

    // split up street and housenumber
    if (streetHousenumber) {
      streetHousenumber = streetHousenumber.trim().split(" ");
      housenumber = streetHousenumber.pop();
      street = streetHousenumber.join(" ");
    }

    // format address
    const formatted = this.formatAddress({ city, street, postal, housenumber });

    // return address object
    return PDokAddress({
      city,
      street,
      postal,
      housenumber,
      formatted,
    });
  }

  /**
   * Format the results from the PDOK locatieserver
   * @param {Object} data - the data from the PDOK locatieserver
   * @returns {Array} the formatted results
   */
  formatResults(data) {
    // get fields
    let docs = data.response.docs;
    let highlighting = data.highlighting;

    // loop through docs and format them
    let formattedDocs = docs.map((doc) => {
      // infer address
      let address = this.inferAddress(doc);

      // if address has all fields but postal, remove it
      if (
        Object.values(address).filter(Boolean).length === 4 &&
        address.postal === undefined
      ) {
        return null;
      }

      // get highlight
      let highlight = highlighting[doc.id].suggest[0];

      // return formatted doc
      return { ...doc, address, highlight };
    });

    // filter out empty results
    formattedDocs = formattedDocs.filter(Boolean);

    // filter out duplicates
    let formatted = formattedDocs.map((e) => e.address.formatted);

    // filter out duplicates values of .address.formatted
    formattedDocs = formattedDocs.filter(
      (e, i) => formatted.indexOf(e.address.formatted) === i
    );

    // return formatted results
    return formattedDocs;
  }

  /**
   * Format the info from the PDOK locatieserver
   * @param {Object} data - the data from the PDOK locatieserver
   * @returns {Object} the formatted info
   */
  formatInfo(data) {
    // get first docs
    let docs = data.response.docs;

    // main doc is the first of type adres
    data = docs.find((doc) => doc.type === "adres");

    // if no postcode try to find the next one
    if (!data.postcode) {
      // filter out docs without postcode + get postcode
      const postcodes = docs
        .filter((doc) => doc?.postcode)
        .map((e) => e.postcode);

      // set postcode to first postcode if available
      if (postcodes.length > 0) data.postcode = postcodes[0];

      data.warning =
        "Geen postcode gevonden, eerste gevonden postcode is: " + data.postcode;
    }

    // get lat long
    let [lat, lng] = data.centroide_ll
      .replace("POINT(", "")
      .replace(")", "")
      .split(" ");
    data.lat = parseFloat(lat);
    data.lng = parseFloat(lng);

    data.address = {
      street: data.straatnaam,
      housenumber: data.huis_nlt,
      postal: data.postcode,
      city: data.woonplaatsnaam,
    };
    data.address.formatted = this.formatAddress(data.address);

    // set country
    data.country = "Nederland";

    // return data
    return data;
  }

  /**
   * Debounce function
   * @param {Function} func - the function to debounce
   * @param {number} timeout - the timeout to debounce
   * @returns {Function} the debounced function
   */
  debounce(func, timeout = 300) {
    let timer;
    return (...args) => {
      return new Promise((resolve, reject) => {
        clearTimeout(timer);
        timer = setTimeout(() => {
          resolve(func.apply(this, args));
        }, timeout);
      });
    };
  }

  /**
   * Do a request to the PDOK locatieserver
   * @param {string} endpoint - the endpoint to request
   * @param {Object} body - the body to send
   * @param {boolean} abort - whether to abort previous requests
   * @param {number} debounce - the debounce time
   * @returns {Object} the response data
   */
  async doRequest(endpoint, body = {}, abort = true, debounce = 50) {
    // cancel AbortControllers for endpoint
    if (abort) {
      this.aborters = this.aborters || {};
      this.aborters[endpoint]?.abort();
    }

    // create new AbortController
    this.aborters[endpoint] = new AbortController();
    let signal = this.aborters[endpoint].signal;

    // request function
    const request = async () => {
      // construct url
      const url = `${this.apiRoot}/${endpoint}?${new URLSearchParams(body)}`;

      // do request
      const response = await fetch(url, { signal });
      const data = await response.json();

      // return data
      return data;
    };

    // when debounce is 0, return the request
    if (debounce === 0) {
      return await request();
    }

    // create debounced request
    let debouncedRequest = this.debounce(request, debounce);

    // return the debounced request
    return await debouncedRequest();
  }
}
