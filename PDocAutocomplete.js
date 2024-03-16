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

class EventHandler {
  constructor() {
    this.events = {};
  }

  on(event, callback) {
    this.events[event] = this.events[event] || [];
    this.events[event].push(callback);
  }

  off(event, callback) {
    if (this.events[event]) {
      this.events[event] = this.events[event].filter((cb) => cb !== callback);
    }
  }

  emit(event, ...args) {
    if (this.events[event]) {
      this.events[event].forEach((cb) => cb(...args));
    }
  }
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

    // style
    this.appendStyle();

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
        console.log(this.selected);
        this.fillInput(this.selected);
      }
    });
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

  appendStyle() {
    let style = document.createElement("style");
    style.innerHTML = `
      input:focus:not([data-pdok-status]) + .pdok-results {
        opacity:1;
        transition-delay: 0s;
        pointer-events: all;
      }

      .pdok-results {
        position: absolute;
        z-index: 1000;
        background-color: white;
        border: 1px solid #ccc;
        max-height: 200px;
        overflow-y: auto;
        list-style: none;
        padding: 0;
        pointer-events: none;
        opacity:0;
        margin: 0;
        transition-delay: 0.1s;
      }
      .pdok-results li {
        padding: 10px;
        cursor: pointer;
      }

      .pdok-results li:is(.is-selected, :hover) {
        background-color: #f5f5f5;
      }

      [data-pdok-status] {
        background-position: calc(100% - 10px) center;
        background-size: 16px;
        background-repeat: no-repeat;
      }

      [data-pdok-status="check"] {
        background-image:  url('data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACAAAAAgCAYAAABzenr0AAADaElEQVRYR41XS2sUQRCupZdMfOW2EBDEg3EPgiAI3lRQb/tzc1Mh3hVBUQiKoCIKOfrKSgb8uvpVXV3TmV52dqa7Hl/XV9VTu6D5Yw+i91vxAVNbCldKvy9w+3OO6cUMoZuQ8d/ucORoxEeNYzx/6Cn2AFyA4qO8NWVlcNjxMm47rjnMjQ0GXnyG76kFZArAAYTX/S0P5MZt3DMIcCAgOgcOGhlhheYVpr9rmxaAO2DyamAUw8E4HMUHM9DsMMl6Pf/gJ/1lLGHaIfryj+iNBKEBHEBnnalkI3HYoS3rSdaQK3tgqC9x+ZEUJYBdLD9e+sj51THuq0OsRVGqhrSWcfkbDgbbfY7LXy8jAWwsg/VcAjUnKpAdEA7eTSaJFeOeDiWAUGppt4XUwrmwkSufEy8tyEKM99Jv4qHkK1PBEYDcJtsRW2ZHbKRYqvdSx6fI61hqrUzMIQDc2HP0MZ9wdQ4lQVXwkuBKoQevgBJ5cgQAA7hPZQahFKKurWKiSf6gx/xCahMi2KQkTwz4eAo2c3CzTPLbV2DncYjErkEnTAwgwPH1F6dFjFpfohLkyRc8Zue8e0WVOtM4MgDgAAB3Ktl0GpnPNbpm5xZ4h9LMByuMlggYHhw4GkN+JONTZ0XlvKo+mQLso4a14BJspiOaItuEllkacN1u7bDDUVAPPE2lzeIiAPzpCIjAWMk1kXBBqykA4z2RKTi/ElhCOpSkVdTkijmL8VfGw2O4MgBfj1vZUCn4Sl+DMPOityGZ77kKGgVMOIRs4i1cDhqVvI0d9XrMx7WPwNJHYE1X6JgemIiNSVnL2XaXv8mTxEP3RzGPTZOmE31AcKoLzWccWDUiZmETc/5lxAM9oFu3fW3LQ35jY0k3oJOBsBfew+8nsyGRWVrnI4qWZNHG58yF7odEglQRLRWVAVwn2v2KlqzX+mlgKv9y5Ve+/GF1pjpmoqfMJEbVlK4u0f7Jb7rbGi4zVkpV1EWBCmxSCr+vcf2WLBpt+c5tZNM1LkAjHCkJ2Wkq6Nz7TUOPUfkMibdSauqPyQq278k2rVtpvZDxO4HfCFU73olAtjYA9ZORUfhx3h+DpFdxkCYz5xrrnD+n+1AqeeFjmeipuWXb6vjgUusFaA4A1r+1osvvTuihaUyUYcC0PcLPry4zcfE/rwE6VS7cF4IAAAAASUVORK5CYII=');
      }

      [data-pdok-status="warn"] {
        background-image:   url('data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACAAAAAgCAYAAABzenr0AAACjElEQVRYR51Xz0sdMRDOY4Vn0XoTSgvFSy1eBEXorS20PQjvzxU8tILeawUFbSkUW+iPeyuthwf9Jsm+zezOTGYN7BqTmck333zJ5k2Cv63B9Hlr3qAzjy8xwAlGf3tCTxxGm7ChJzd91TCc+gSnz9YaFoB7cHwlOxsgRIeNdyFc/5OmNABPYPzUwc4Yk1MY/+w7SAB2QmgeacUVaB4D4huMz0uHPoCc+RQ2t8nOwfbQxHR6j6i/WhAdgI2wHK7Da9+aygI0TE3aGZibYjyndQSrv2RaMjCTuExLdYxM0b9tw5jkV6k7KAGwrVZ17Wi6yhi26kIYRI2laBmYFUnWY3UWMQv4zoiUBkTNM8c8SGZwmNkBAWAn3HB1k48EIACA2gpBZ5si4gkBmDGlL2bRaaCaKKhWXUvosxQdAGxCE4ASAVcr0cvX5P8rAHIWPd9FbsV4BjCCQDg3IGGeQDsZKMvIUU1aAS0gVLcAC1AHMJQAy1ZhgHsZmOoAKnuqWgLdf0wJuij9ZHwAJBrT2Ee8KQa+nBWu4zw1flC4SqDjl/mxoXAOfAz4FdpDVGMl0WecYooCuiToPKe2dxcuqGwTFO8+Lm4vWIDqVozWH/D8yH4P8XdXAlFyIPBx3H2MVLmraGQABngBQPwYUSvugFIEtZYEgvS9y7XtkuElXL9ULyQqMZiwK2WASFPsQkLrLOOJV7Ku+cRggVTm3kYIaP1L6QOMKYrOoeo7q2Z4BoPvLTDpWr6Nycd3yKq2cAgrK1/Dzc1FGVv7YbIOaT0jltQijK8Ou45bDOS5fZB9+MZmQj7fhz77qPmheFv0/DhlupATH47mkbjVrCQ8AFr/VXReWpsv6TMufYzXH4+O/gPD3KU5b2HElgAAAABJRU5ErkJggg==');

      }
    `;
    document.head.appendChild(style);
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
    console.log({ index });

    // when there are options and index is not set, set it to 0
    if (index === -1 || (index === -1 && this.data.length > 0)) index = 0;

    // when this.data is empty, return
    if (this.data.length === 0) return;

    // this.root.value = this.data[index].address.formatted;
    this.emit("select", this.data[index]);

    console.log(this.data[index], this.data, index);

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

    console.log("render");

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
      console.log(item);
      item.addEventListener("pointerdown", () => this.fillInput(index));

      // append item to results
      this.results.appendChild(item);
    }

    // append results to root
    this.root.insertAdjacentElement("afterend", this.results);
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

    this.results.on("select", async (data) => {
      this.root.value = data.address.formatted;

      if (data.type !== "adres") return;

      // has all values
      let isValid = Object.values(data.address).filter(Boolean).length >= 4;

      // filter out empty and undefined values
      if (isValid) {
        const info = await this.getInfo(data.address.formatted);
        console.log(info);
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
    });

    // add event listeners
    this.root.addEventListener("input", (e) => {
      this.results.uncheck();
      if (this?.checked) {
        this.emit("unselect");
        this.checked = false;
      }

      this.input(e);
    });
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
