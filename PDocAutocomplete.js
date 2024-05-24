import { EventHandler } from './EventHandler';
import { RequestHandler } from './RequestHandler';

/**
 * PDokAddress
 *
 * @param {string} address.street      - the street name
 * @param {string} address.housenumber - the house number
 * @param {string} address.postcode    - the postal code
 * @param {string} address.city        - the city
 * @param {string} address.formatted   - the formatted address
 * @return {Object} the address object
 */
function PDokAddress( { street, housenumber, postal, city, formatted } ) {
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
	 *
	 * @param {HTMLElement} input - the input element to attach the results to
	 * @return {Object} the PDokResults object
	 */
	constructor( input ) {
		super();

		// set root
		this.root = input;
		this.id = `pdok-${ Math.random().toString( 36 ).substr( 2, 9 ) }`;
		this.root.dataset.pdokInput = this.id;

		// on up down key
		this.root.addEventListener( 'keydown', ( e ) => {
			// prevent default on arrow up, arrow down and enter
			if ( [ 'ArrowUp', 'ArrowDown', 'Enter', 'Escape' ].includes( e.key ) ) {
				e.preventDefault();
			}

			// move selection down on arrow down
			if ( e.key === 'ArrowDown' ) {
				this.moveSelection( 1 );
			}

			// move selection up on arrow up
			if ( e.key === 'ArrowUp' ) {
				this.moveSelection( -1 );
			}

			// fill input on enter
			if ( e.key === 'Enter' ) {
				this.fillInput( this.selected );
			}

			// hide results on escape
			if ( e.key === 'Escape' ) {
				this.root.blur();
			}
		} );

		this.appendStyles();
	}

	startLoader() {
		this.root.dataset.pdokLoading = 'false';
	}

	stopLoader() {
		delete this.root.dataset.pdokLoading;
	}

	check() {
		this.unwarn();
		this.root.blur();
		this.root.dataset.pdokStatus = 'check';
	}

	uncheck() {
		this.unwarn();
	}

	warn( warning ) {
		// this.root.blur();
		this.root.dataset.pdokStatus = 'warn';
		this.root.dataset.pdokMessage = warning;
		this.warning = warning;
		console.warn( warning );
		this.render( this.data );
	}

	unwarn() {
		delete this.root.dataset.pdokStatus;
		delete this.root.dataset.pdokMessage;
		delete this.warning;
		this.render( this.data );
	}

	move( input ) {
		const box = input.getBoundingClientRect();

		this.results.style.top = `${ Math.floor( box.bottom + window.scrollY ) }px`;
		this.results.style.left = `${ Math.floor( box.left ) }px`;
		this.results.style.width = `${ box.width }px`;
	}

	/**
	 * Move the selection up or down
	 *
	 * @param {number} step - the step to move
	 * @return void
	 */
	moveSelection( step ) {
		// get items
		const items = this.results?.querySelectorAll( 'li' );

		// if no items, return
		if ( ! items ) {
			return;
		}

		// set selected
		this.selected = this.selected || 0;

		// move selection and keep it between 0 and items.length
		this.selected = Math.min(
			Math.max( this.selected + step, 0 ),
			items.length - 1
		);

		// remove selected class from all items
		items.forEach( ( item ) => {
			item.classList.remove( 'is-selected' );
		} );

		// ensure the selected is in view
		items[ this.selected ].scrollIntoView( {
			block: 'nearest',
		} );

		// add selected class to selected
		items[ this.selected ].classList.add( 'is-selected' );
	}

	/**
	 * Fill the input with the address data.
	 * Also sets the cursor to the end of the input
	 *
	 * @param {Object} data  - the address data
	 * @param          index
	 */
	fillInput( index ) {
		// when there are options and index is not set, set it to 0
		if ( index === -1 || ( index === -1 && this.data.length > 0 ) ) {
			index = 0;
		}

		// when this.data is empty, return
		if ( this.data.length === 0 ) {
			return;
		}

		// this.root.value = this.data[index].address.formatted;
		this.emit( 'select', this.data[ index ] );

		// fire input event
		const event = new Event( 'input', { bubbles: true } );
		this.root.dispatchEvent( event );

		// set cursor to end of input
		window.requestAnimationFrame( () => {
			this.root.focus();
		} );
	}

	render( data ) {
		this.data = data;
		this.selected = -1;

		// remove old results
		this.results?.remove();
		this.results = document.createElement( 'div' );
		const ul = document.createElement( 'ul' );
		this.results.classList.add( 'pdok-results' );
		this.results.style.width = this.root.offsetWidth + 'px';
		this.results.dataset.pdokResults = this.id;

		// append results to root
		document.body.append( this.results );

		if ( data.length === 0 ) {
			// this.warn('Geen resultaten gevonden');
		}

		// render new results
		for ( const [ index, result ] of Object.entries( data ) ) {
			// create item
			const item = document.createElement( 'li' );

			// set item content
			if ( this.showHighlight ) {
				item.innerHTML = result.highlight;
			} else {
				item.innerHTML = result.address.formatted;
			}
			// bind click event to fill input
			item.addEventListener( 'pointerdown', () => this.fillInput( index ) );

			// append item to results
			ul.append( item );
		}

		if ( this.warning ) {
			const warning = document.createElement( 'div' );
			warning.classList.add( 'pdok-warning' );
			warning.innerText = this.warning;
			this.results.append( warning, );
		}

		this.results.append( ul );

		this.move( this.root );
	}

	appendStyles() {
		const style = document.createElement( 'style' );
		style.innerHTML = `
    body:has([data-pdok-input="${ this.id }"]:focus) [data-pdok-results="${ this.id }"] {
      display:block;
    }
    `;
		document.head.append( style );
	}
}

/**
 * PDokAutocomplete
 * Use the PDOK locatieserver to autocomplete addresses
 */
export default class PDokAutocomplete extends EventHandler {
	// API root
	apiRoot = 'https://api.pdok.nl/bzk/locatieserver/search/v3_1';

	/**
	 * create a new PDokAutocomplete
	 *
	 * @param {HTMLElement} root - the input element to attach the autocomplete to
	 */
	constructor( root ) {
		super();

		// set settings
		this.root = root;
		this.results = new PDokResults( root );
		this.requestHandler = new RequestHandler( this.apiRoot );

		// transform input
		this.root.setAttribute( 'autocomplete', 'off' );

		this.results.on( 'select', async ( data ) => this.onSelect( data ) );

		// add event listeners

		// handle partial input
		this.root.addEventListener( 'blur', ( e ) => {
			if ( this.checked || this.root.value === '' ) {
				return;
			}
			this.results.warn( 'Selecteer een adres uit de lijst' );
		} );

		this.root.addEventListener( 'input', ( e ) => this.input( e ) );
	}

	async onSelect( data ) {
		this.root.value = data.address.formatted;

		if ( data.type !== 'adres' ) {
			return;
		}

		// has all values
		const isValid = Object.values( data.address ).filter( Boolean ).length >= 4;

		if ( isValid ) {
			this.results.startLoader();
			const info = await this.getInfo( data.address.formatted );
			// const idInfo = await this.getInfoByID( data.id, data.address.formatted );

			this.results.stopLoader();

			// check if the info is the same as the selected address
			if ( info.address.formatted === data.address.formatted ) {
				this.checked = true;
				this.results.check();
				this.emit( 'select', info );
			} else {
				this.results.warn(
					'Dit adres bestaat niet of is een gedeeld adres'
				);
			}

			if ( info?.warning ) {
				this.results.warn( info.warning );
			}
		}

		// when type is address but is not valid
		if ( ! isValid ) {
			this.emit( 'error', data );
		}
	}

	async getSuggestions( value ) {
		// do request
		let data = await this.requestHandler.doRequest( 'suggest', {
			q: value,
			fq: 'type:(woonplaats OR weg OR postcode OR adres)',
			fq: 'bron:BAG',
			rows: 30,
		} );

		// format results
		data = this.formatResults( data );

		return data;
	}

	async getGeoLocation() {
		return new Promise( ( resolve, reject ) => {
			if ( navigator.geolocation ) {
				navigator.geolocation.getCurrentPosition( ( position ) => {
					resolve( {
						lat: position.coords.latitude,
						lng: position.coords.longitude,
					} );
				}, ( ) => reject() );
			}
		} );
	}

	async getInfoByGeoLocation() {
		this.results.startLoader();

		const { lat, lng } = await this.getGeoLocation();

		const address = await this.getInfoByLocation( lat, lng );

		this.root.value = address.address.formatted;
		this.emit( 'select', address );
		this.results.render( [] );
		this.results.check();

		this.results.stopLoader();

		return address;
	}

	async getInfoByLocation( lat, lon ) {
		// do request
		const data = await this.requestHandler.doRequest( 'reverse', { lat, lon } );

		const docID = data.response.docs[ 0 ].id ?? false;

		if ( ! docID ) {
			return false;
		}

		const address = await this.getInfoByID( docID );

		return address ?? false;
	}

	async getInfo( q ) {
		// do request
		const data = await this.requestHandler.doRequest( 'free', { q } );

		const docs = this.formatDocs( data.response.docs );

		const doc = this.getDocFromAddress( docs, q );

		// format results
		// data = this.formatInfo( data );

		return doc;
	}

	async getInfoByID( id, address = false ) {
		// do request
		const data = await this.requestHandler.doRequest( 'lookup', { id } );

		const docs = this.formatDocs( data.response.docs );

		let doc = docs[ 0 ] ?? false;
		if ( address !== false ) {
			doc = this.getDocFromAddress( docs, address );
		}

		// format results
		// data = this.formatInfo( data );

		return doc;
	}

	/**
	 * onInput
	 *
	 * @description handle input event
	 * @param {*} event
	 * @return void
	 */
	async input( event ) {
		// reset check
		if ( this?.checked ) {
			this.emit( 'unselect' );
			this.checked = false;
		}

		// get value
		const value = event.target.value;

		// if empty, render empty results
		if ( value.length === 0 ) {
			this.results.render( [] );
			this.results.uncheck();
			return;
		}

		this.results.startLoader();

		// get suggestions
		const data = await this.getSuggestions( value );

		// render results
		this.results.render( data );

		this.results.stopLoader();
	}

	/**
	 * Takes an address object and formats it to a string
	 *
	 * @param {PDokAddress} address - the address object
	 * @return {string} the formatted address
	 */
	formatAddress( address ) {
		const postalCity = [ address.city ].filter( Boolean ).join( ' ' );
		const streetHousenumber = [ address.street, address.housenumber ]
			.filter( Boolean )
			.join( ' ' );
		let formatted = [ postalCity, streetHousenumber ].join( ', ' ).trim();

		// if we do not have a house number add spacing
		if ( ! address.housenumber ) {
			formatted = `${ formatted } `;
		}

		return formatted;
	}

	/**
	 * Takes a record from the PDOK locatieserver and infers the address fields
	 *
	 * @param {Object} record - the record from the PDOK locatieserver
	 * @return {PDokAddress} the inferred address
	 */
	inferAddress( record ) {
		// initialize variables
		let city, street, postal, housenumber, postalCity, streetHousenumber;
		const name = record.weergavenaam;

		// infer street fields
		if ( record.type === 'weg' ) {
			[ street, city ] = name.split( ',' );
		}

		// infer postal fields
		if ( record.type === 'postcode' ) {
			[ street, postalCity ] = name.split( ',' );
		}

		// infer address fields
		if ( record.type === 'adres' ) {
			[ streetHousenumber, postalCity ] = name.split( ',' );
		}

		// infer city fields
		if ( record.type === 'woonplaats' ) {
			[ city ] = name.split( ',' );
		}

		// split up postal and city
		if ( postalCity ) {
			postalCity = postalCity.trim().split( ' ' );

			// if the first part begins with a number, it's the postal code
			if ( postalCity[ 0 ].match( /^\d/ ) ) {
				postal = postalCity.shift();
			}

			// the rest is the city
			city = postalCity.join( ' ' );
		}

		// split up street and housenumber
		if ( streetHousenumber ) {
			streetHousenumber = streetHousenumber.trim().split( ' ' );
			housenumber = streetHousenumber.pop();
			street = streetHousenumber.join( ' ' );
		}

		// format address
		const formatted = this.formatAddress( { city, street, postal, housenumber } );

		// return address object
		return PDokAddress( {
			city,
			street,
			postal,
			housenumber,
			formatted,
		} );
	}

	/**
	 * Format the results from the PDOK locatieserver
	 *
	 * @param {Object} data - the data from the PDOK locatieserver
	 * @return {Array} the formatted results
	 */
	formatResults( data ) {
		// get fields
		const docs = data.response.docs;
		const highlighting = data.highlighting;

		// loop through docs and format them
		let formattedDocs = docs.map( ( doc ) => {
			// infer address
			const address = this.inferAddress( doc );

			// if address has all fields but postal, remove it
			if (
				Object.values( address ).filter( Boolean ).length === 4 &&
        address.postal === undefined
			) {
				return null;
			}

			// get highlight
			const highlight = highlighting[ doc.id ].suggest[ 0 ];

			// return formatted doc
			return { ...doc, address, highlight };
		} );

		// filter out empty results
		formattedDocs = formattedDocs.filter( Boolean );

		// filter out duplicates
		const formatted = formattedDocs.map( ( e ) => e.address.formatted );

		// filter out duplicates values of .address.formatted
		formattedDocs = formattedDocs.filter(
			( e, i ) => formatted.indexOf( e.address.formatted ) === i
		);

		// return formatted results
		return formattedDocs;
	}

	getDocFromAddress( docs, address ) {
		// get doc from address
		const data = docs.find( ( doc ) => doc.address.formatted === address );

		// if no doc found, return first
		if ( ! data ) {
			return false;
		}

		// return doc
		return data;
	}

	formatDocs( docs ) {
		let newDocs = docs.map( ( doc ) => this.formatDoc( doc ) );

		// filter out empty results that are false
		newDocs = newDocs.filter( ( doc ) => doc !== false );

		console.log( newDocs );

		return newDocs;
	}

	formatDoc( data ) {
		// get lat long
		const [ lng, lat ] = data.centroide_ll
			.replace( 'POINT(', '' )
			.replace( ')', '' )
			.split( ' ' );
		data.lat = parseFloat( lat );
		data.lng = parseFloat( lng );

		if ( data.postcode === undefined ) {
			return false;
		}

		data.address = {
			street: data.straatnaam,
			housenumber: data.huis_nlt,
			postal: data.postcode,
			postalNumber: data.postcode.substring( 0, 4 ),
			city: data.woonplaatsnaam,
			lat: data.lat,
			lng: data.lng,
		};
		data.address.formatted = this.formatAddress( data.address );

		// set country
		data.country = 'Nederland';

		// return data
		return data;
	}

	/**
	 * Format the info from the PDOK locatieserver
	 *
	 * @param {Object} data - the data from the PDOK locatieserver
	 * @return {Object} the formatted info
	 */
	formatInfo( data ) {
		// get first docs
		const docs = data.response.docs;

		// main doc is the first of type adres
		data = docs.find( ( doc ) => doc.type === 'adres' );

		// if no postcode try to find the next one
		if ( ! data.postcode ) {
			// filter out docs without postcode + get postcode
			const postcodes = docs
				.filter( ( doc ) => doc?.postcode )
				.map( ( e ) => e.postcode );

			// set postcode to first postcode if available
			if ( postcodes.length > 0 ) {
				data.postcode = postcodes[ 0 ];
			}

			data.warning =
        'Geen postcode gevonden, eerste gevonden postcode is: ' + data.postcode;
		}

		// get lat long
		const [ lat, lng ] = data.centroide_ll
			.replace( 'POINT(', '' )
			.replace( ')', '' )
			.split( ' ' );
		data.lat = parseFloat( lat );
		data.lng = parseFloat( lng );

		data.address = {
			street: data.straatnaam,
			housenumber: data.huis_nlt,
			postal: data.postcode,
			city: data.woonplaatsnaam,
			lat: data.lat,
			lng: data.lng,
		};
		data.address.formatted = this.formatAddress( data.address );

		// set country
		data.country = 'Nederland';

		// return data
		return data;
	}
}

