import React from 'react'

const SVGDiv =  props => <svg  version="1.1" style={{'padding': '13px',
  'width': '13px',
  'height': '13px'}} {...props}>
<line x1="1" y1="9"
     x2="9" y2="1"
     strokeWidth="1"/>
<line x1="1" y1="1"
     x2="9" y2="9"
     strokeWidth="1"/>
</svg>

export default SVGDiv
