import {test} from 'node:test';
import assert from 'node:assert/strict';
import {useProviderBanner} from '../src/components/bannerArtworkPolicy.ts';

test('a valid server banner remains selected even when provider artwork is larger',()=>{
  assert.equal(useProviderBanner(false,true,1920),false);
  assert.equal(useProviderBanner(false,true,780),false);
  assert.equal(useProviderBanner(false,true,-1),false);
});
test('explicit device artwork wins over a valid server banner',()=>{
  assert.equal(useProviderBanner(true,true,3840),true);
});
test('missing and failed server banners still allow provider recovery',()=>{
  assert.equal(useProviderBanner(false,false,-1),true);
  assert.equal(useProviderBanner(false,true,0),true);
});
