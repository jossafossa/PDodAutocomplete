/**
 * PDocAddress
 * @param {string} address.street - the street name
 * @param {string} address.housenumber - the house number
 * @param {string} address.postcode - the postal code
 * @param {string} address.city - the city
 * @param {string} address.formatted - the formatted address
 * @returns {Object} the address object
 */
function PDocAddress({ street, housenumber, postcode, city, formatted }) {
  return {
    street,
    housenumber,
    postcode,
    city,
    formatted,
  };
}

/**
 * PDocResults
 * Handles the rendering of the results
 */
class PDocResults {
  /**
   * Create a new PDocResults
   * @param {HTMLElement} input - the input element to attach the results to
   * @returns {Object} the PDocResults object
   */
  constructor(input) {
    // set root
    this.root = input;

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
    if (index === -1) return;

    this.root.value = this.data[index].address.formatted;

    console.log(this.data[index]);

    // fire input event
    let event = new Event("input", { bubbles: true });
    this.root.dispatchEvent(event);

    // set cursor to end of input
    this.root.focus();
  }

  render(data) {
    this.data = data;
    this.selected = -1;

    console.log(data);

    // remove old results
    this.results?.remove();
    this.results = document.createElement("ul");

    // render new results
    for (let [index, result] of Object.entries(data)) {
      // create item
      let item = document.createElement("li");

      // set item content
      item.innerHTML = result.highlight;

      // bind click event to fill input
      item.addEventListener("click", () => this.fillInput(index));

      // append item to results
      this.results.appendChild(item);
    }

    // append results to root
    this.root.insertAdjacentElement("afterend", this.results);
  }
}

/**
 * PDocAutocomplete
 * Use the PDOK locatieserver to autocomplete addresses
 */
export default class PDocAutocomplete {
  // API root
  apiRoot = "https://api.pdok.nl/bzk/locatieserver/search/v3_1";

  /**
   * create a new PDocAutocomplete
   * @param {HTMLElement} root - the input element to attach the autocomplete to
   */
  constructor(root) {
    // set settings
    this.root = root;
    this.results = new PDocResults(root);

    // add event listeners
    this.root.addEventListener("input", (e) => {
      this.input(e);
    });

    // TODO: add full address event listener
    // TODO: style and bundle dropdown
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

    // do request
    let data = await this.doRequest("suggest", {
      q: value,
      fq: "type:(woonplaats OR weg OR postcode OR adres)",
    });

    // format results
    data = this.formatResults(data);

    // render results
    this.results.render(data);
  }

  /**
   * Takes an address object and formats it to a string
   * @param {PDocAddress} address - the address object
   * @returns {string} the formatted address
   */
  formatAddress(address) {
    let streetHousenumber = [address.street, address.housenumber]
      .filter(Boolean)
      .join(" ");
    let postcode = address.postcode;
    let city = address.city;
    return [city, streetHousenumber].join(", ").trim() + " ";
  }

  /**
   * Takes a record from the PDOK locatieserver and infers the address fields
   * @param {Object} record - the record from the PDOK locatieserver
   * @returns {PDocAddress} the inferred address
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
    return PDocAddress({
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
    let docs = data.response.docs;
    console.log(data);
    let highlighting = data.highlighting;

    let formattedDocs = docs.map((doc) => {
      let address = this.inferAddress(doc);
      let highlight = highlighting[doc.id].suggest[0];
      return { ...doc, address, highlight };
    });

    return formattedDocs;
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
