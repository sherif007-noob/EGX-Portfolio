import { describe, expect, it } from 'vitest';
import { modalViewportRect } from './modalViewportGeometry';

describe('fixed modal positioning relative to the visible screen', () => {
  it('centers within an unzoomed phone viewport even if iOS reports page-level offset', () => {
    expect(modalViewportRect({
      layoutWidth:390,layoutHeight:844,visualWidth:390,visualHeight:844,
      offsetLeft:0,offsetTop:1430,
    })).toEqual({left:0,top:0,width:390,height:844});
  });

  it('keeps the modal in the visible area when the iOS keyboard reduces viewport height', () => {
    expect(modalViewportRect({
      layoutWidth:390,layoutHeight:844,visualWidth:390,visualHeight:506,
      offsetLeft:0,offsetTop:1520,
    })).toEqual({left:0,top:338,width:390,height:506});
  });

  it('preserves legitimate pinch-zoom visual viewport offsets', () => {
    expect(modalViewportRect({
      layoutWidth:430,layoutHeight:932,visualWidth:250,visualHeight:510,
      offsetLeft:80,offsetTop:126,
    })).toEqual({left:80,top:126,width:250,height:510});
  });

  it('rejects impossible or invalid viewport geometry rather than moving a dialog offscreen', () => {
    const rect=modalViewportRect({
      layoutWidth:390,layoutHeight:844,visualWidth:950,visualHeight:2000,
      offsetLeft:Infinity,offsetTop:NaN,
    });
    expect(rect).toEqual({left:0,top:0,width:390,height:844});
  });
});
