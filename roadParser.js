

var skyroads = skyroads || {};

(function (skyroads) {

var types = {
  header: jBinary.Type({
  	read: function() {
  		var pos = this.binary.tell();
  		var firstOffset = this.binary.read(['uint16', true]);
  		this.binary.seek(pos);
  		return this.binary.read(['array', 'levelHeader', firstOffset / 2 / 2]);
  	},
  	write: function(values) {
  		this.binary.write(['array', 'levelHeader'], values);
  	}
  }),
  levelHeader: {
  	offset: ['uint16', true],
  	length: ['uint16', true]
  },
  level: jBinary.Template({
  	setParams: function(length) {
  		this.baseType = {
		  	gravity: ['uint16', true],
		  	fuel:    ['uint16', true],
		  	oxygen:  ['uint16', true],
		  	palette: ['array', 'byte', 72*3],
		  	road:    ['array', 'byte', length - 222]
  		}
  	}
  })
};



function copyTo(from, fromOffset, count, to, toOffset) {
  var out = "";
  for (var i = 0; i < count; i++) {
    to[toOffset + i] = from[fromOffset + i];
    out += from[fromOffset + i];
  }
}

function decompress(road, finalLength) {

  var byteLength = road.length;
  var inBuf = new Uint8Array(byteLength);
  for (var i = 0; i < byteLength; i++) {
    inBuf[i] = road[i];
  };
  var input = new BitStream(inBuf);
  var outBuf = new ArrayBuffer(finalLength);

  var width1 = input.readBits(8);
  var width2 = input.readBits(8);
  var width3 = input.readBits(8);

  var index = 0;
  var dist = 0;
  var count = 0;
  var val = null;

  while (index < finalLength) {
    if (input.readBits(1) == 0) {
      dist = 2 + input.readBits(width2);
      count = 2 + input.readBits(width1);
      copyTo(outBuf, index - dist, count, outBuf, index);
      index += count;
    } else if (input.readBits(1) == 0) {
      dist = 2 + (1 << width2) + input.readBits(width3);
      count = 2 + input.readBits(width1);
      copyTo(outBuf, index - dist, count, outBuf, index);
      index += count;
    } else {
      val = input.readBits(8);
      outBuf[index] = val;
      index++;
    }
  }
  var output = new BitStream(outBuf);
  return output;
}

function parseLevels(err, binary) {
  var headers = binary.read('header');
  // console.log(headers);
  var levels = [];
  for (var i = 0; i < headers.length; i++) {
    // var i = 10;
    var header = headers[i];
    var length = 0;
    if (i == headers.length - 1) {
      length = binary.view.byteLength - header.offset;
    } else {
      length = headers[i+1].offset - header.offset;
    }
    level = binary.read(['level', length]);
    level.road = decompress(level.road, header.length);
    // break;
    levels.push(level);
  };

  return levels;
}

function loadLevels(path, cb) {
  jBinary.load(path, types, function(err, binary) {
    if (err != null) {
      cb(err,null);
    } else {
      cb(null, parseLevels(err, binary));
    }
  });
}

skyroads.loadLevels = loadLevels;
skyroads.parseLevels = parseLevels;

})(skyroads);