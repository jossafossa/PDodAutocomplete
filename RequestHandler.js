export class RequestHandler {
	constructor( apiRoot ) {
		this.apiRoot = apiRoot;
		this.cache = new Map();
	}

	getFromCache( endpoint, object ) {
		const key = JSON.stringify( [ endpoint, object ] );
		const response = this.cache.get( key );
		if ( ! response ) {
			return null;
		}
		response.cached = true;
		return response;
	}

	setCache( endpoint, object, value ) {
		const key = JSON.stringify( [ endpoint, object ] );
		this.cache.set( key, value );
	}

	/**
	 * Debounce function
	 *
	 * @param {Function} func    - the function to debounce
	 * @param {number}   timeout - the timeout to debounce
	 * @return {Function} the debounced function
	 */
	debounce( func, timeout = 300 ) {
		let timer;
		return ( ...args ) => {
			return new Promise( ( resolve ) => {
				clearTimeout( timer );
				timer = setTimeout( () => {
					resolve( func.apply( this, args ) );
				}, timeout );
			} );
		};
	}

	/**
	 * Do a request to the PDOK locatieserver
	 *
	 * @param {string}  endpoint - the endpoint to request
	 * @param {Object}  body     - the body to send
	 * @param {boolean} abort    - whether to abort previous requests
	 * @param {number}  debounce - the debounce time
	 * @return {Object} the response data
	 */
	async doRequest( endpoint, body = {}, abort = true, debounce = 100 ) {
		// cancel AbortControllers for endpoint
		if ( abort ) {
			this.aborters = this.aborters || {};
			this.aborters[ endpoint ]?.abort( 'Abort previous request' );
		}

		// get from cache
		const cached = this.getFromCache( endpoint, body );
		if ( cached ) {
			return cached;
		}

		// create new AbortController
		this.aborters[ endpoint ] = new AbortController();
		const signal = this.aborters[ endpoint ].signal;

		// request function
		const request = async () => {
			// construct url
			const url = `${ this.apiRoot }/${ endpoint }?${ new URLSearchParams( body ) }`;
			// do request
			const response = await fetch( url, { signal } );

			const data = await response.json();

			// return data
			return data;
		};

		let result;

		// when debounce is 0, return the request
		if ( debounce === 0 ) {
			try {
				result = await request();
			} catch ( error ) {
			}

			this.setCache( endpoint, body, result );
			return result;
		}

		// create debounced request
		const debouncedRequest = this.debounce( request, debounce );

		// return the debounced request
		result = await debouncedRequest();
		this.setCache( endpoint, body, result );
		return result;
	}
}
