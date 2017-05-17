'use strict';

const chai = require('chai').use(require('sinon-chai'));
const expect = chai.expect;
const MockContext = require('mock-lambda-context');
const lambda = require('../index');

describe('GET discovery', function() {
    let ctx;
    before(function(done) {
        ctx = new MockContext();
        lambda.handler({}, ctx, done);
    });
    it('#should return resources discovery', function() {
        const expected = { resources: { requests: { href: 'http://localhost:3000/requests' } } };
        expect(ctx.succeed).to.be.calledWith(expected);
    });
});
