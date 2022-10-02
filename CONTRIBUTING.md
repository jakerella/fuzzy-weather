
# Want to Contribute?

Awesome! Feel free to submit an issue or PR. I'd love to hear about what issues
you've run into or how to make this better. And if you want to help in that
endeavor please do!

## Submitting Issues

Please be sure to tell me:

* What you were trying to do...
* What code you tried...
* What you expected to happen...
* And what actually happened.

Any errors (and their full messages) would be very helpful along with the version
of Node you were using.

## Want to work on the code?

First, fork and clone the repo. Then be sure you have all the dependencies and
that your local version runs all tests:

```
~/fuzz-weather$ npm i
~/fuzz-weather$ npm test
```

Now, create a feature branch and hack away! Please **be sure to create small, atomic commits**. 
And, of course, you need to write tests. The specs are split up
by module and written in [mocha](https://mochajs.org/) and [chai](http://chaijs.com/api/bdd/)
(using the expect/should BDD pattern). It also uses [nock](https://github.com/node-nock/nock)
to mock out third party API requests. Lastly, be sure to document any API changes
in the README file!

When you're ready to merge it in, create a Pull Request to this
repository. It will be reviewed and merged in when ready. Don't worry about bumping
the version number or anything like that, we'll take care of it.

### Other test and debug things...

If you want to accelerate your development, try running the tests continuously
while coding with `npm run watchtest`. You can also run these and turn on the more
extensive logging (using the `debug` module) while watching tests with:
`npm run watchtestdebug`. It would be good for you to add debug messages in any 
code you add as well, but if you do, **please namespace your debug messages correctly**:

```
let debug = require('debug')('fuzzy-weather:your-new-module')
...

debug('This is a namespaced log message')
```

Then you can run the tests only printing out the debug messages for _your_ module:

`~/fuzzy-weather$ DEBUG=fuzzy-weather:your-new-module* mocha test/specs`

### Want to see the live results?

Running tests is great, but sometimes you want to see what the module _actual produces_.
You can do so by running `node test/live.js`. Please note that this currently will
only get results for Washington, DC. Also, you should put your API key
in an environment variable called `WEATHER_API_KEY`.
