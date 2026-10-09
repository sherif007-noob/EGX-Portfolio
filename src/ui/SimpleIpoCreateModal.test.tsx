import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {describe,expect,it} from 'vitest';
import {SimpleIpoCreateModal} from './SimpleIpoCreateModal';

describe('one-purpose IPO creation',()=>{
  it('only asks for new subscription terms, with no management or allocation flow',()=>{
    const html=renderToStaticMarkup(<SimpleIpoCreateModal isOpen={true} onClose={()=>{}}
      tickers={[]} cashBalance={100000} onSubmit={async()=>true}/>);
    expect(html).toContain('New IPO subscription');
    expect(html).toContain('Requested shares');
    expect(html).toContain('Offer price per share');
    expect(html).toContain('Broker cash hold (%)');
    expect(html).toContain('Order value');
    expect(html).toContain('Record subscription');
    expect(html).not.toContain('Record allocation');
    expect(html).not.toContain('Edit subscription');
    expect(html).not.toContain('Pending orders');
  });
  it('does not render a hidden manager while the creation dialog is closed',()=>{
    const html=renderToStaticMarkup(<SimpleIpoCreateModal isOpen={false} onClose={()=>{}}
      tickers={[]} cashBalance={100000} onSubmit={async()=>true}/>);
    expect(html).toBe('');
  });
});