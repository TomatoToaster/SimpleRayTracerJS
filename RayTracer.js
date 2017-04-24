// Help taken from http://www.macwright.org/literate-raytracer/
// I personally added a checkered floor viasulization
// For some reason I was really obsessed with using double quotes for my JSON keys

var c = document.getElementById("MyCanvas");
var width = 640 * 0.5;
var height = 480 * 0.5;

c.width = width;
c.height = height;
c.style.cssText = 'width' + (width * 2) + 'px;height:' + (height*2) + 'px';
var context = c.getContext('2d');
var data = context.getImageData(0, 0, width, height); //going to alter the pixel values

//--------------------------------------------------------------------------------------------------
//Vector objects are simple {x, y, z}
function Vector3D(x, y, z) {
  return {"x": x, "y": y, "z": z};
}

Vector = {};

Vector.UP = Vector3D(0, 1, 0);
Vector.ZERO = Vector3D(0, 0, 0);
Vector.WHITE = Vector3D(255, 255, 255);

Vector.dotProduct = function(A, B) {
  return (A.x * B.x) + (A.y * B.y) + (A.z * B.z);
};

Vector.crossProduct = function(A, B) {
  return Vector3D(
    (A.y * B.z) - (A.z * B.y),
    (A.z * B.x) - (A.x * B.z),
    (A.x * B.y) - (A.y * B.x)
  );
};

Vector.scale = function(A, t) {
  return Vector3D(A.x * t,  A.y * t, A.z * t);
}

Vector.unitVector = function(A) {
  return Vector.scale(A, 1/Vector.magnitude(A));
}

Vector.add = function(A, B) {
  return Vector3D(A.x + B.x, A.y + B.y, A.z + B.z);
}

Vector.add3 = function(A, B, C) {
  return Vector3D(A.x + B.x + C.x, A.y + B.y + C.y, A.z + B.z + C.z);
}

Vector.subtract = function(A, B) {
  return Vector3D(A.x - B.x, A.y - B.y, A.z - B.z);
}

Vector.magnitude = function(A) {
  return Math.sqrt(Vector.dotProduct(A, A));
}

Vector.reflectThrough = function(A, normal) {
  var D = Vector.scale(normal, Vector.dotProduct(A, normal));
  return Vector.subtract(Vector.scale(D, 2), A);
}
//--------------------------------------------------------------------------------------------------
var scene = {};

scene.camera = {
  point: Vector3D(0, 1.8, 10),
  fieldOfView: 45,
  vector: Vector3D(0, 3, 0)
};

scene.lights = [
  //Vector3D(30, -10, 20),
  Vector3D(-30, -10, 20)
];

scene.objects = [
  {
    "type": 'sphere',
    "point": Vector3D(0, 5.5, -3),
    "color": Vector3D(255, 0, 0),
    "specular": 0.3,
    "lambert": 0.7,
    "ambient": 0.1,
    "radius": 1
  },
  {
    "type": 'sphere',
    "point": Vector3D(0, 3.5, 0),
    "color": Vector3D(155, 155, 155),
    "specular": 0.3,
    "lambert": 0.7,
    "ambient": 0.3,
    "radius": 0.5
  },
  {
    "type": 'sphere',
    "point": Vector3D(-3, 5, -2),
    "color": Vector3D(0, 255, 0),
    "specular": 0.1,
    "lambert": 0.9,
    "ambient": 0.0,
    "radius": 1
  },
  {
    "type": 'sphere',
    "point": Vector3D(3, 5, -4),
    "color": Vector3D(0, 0, 255),
    "specular": 0.6,
    "lambert": 0.7,
    "ambient": 0.1,
    "radius": 1
  },
  {
    "type": 'floor',
    "point": Vector3D(0, 10, 0),
    "color1": Vector3D(255, 99, 71),
    "color2": Vector3D(0, 0, 0),
    "squareSize": 4
  }
];

// function that renders the scene onto Canvas's pixel data array
function render(scene) {
  var camera = scene.camera;
  var objects = scene.objects;
  var lights = scene.lights;

  var eyeVector = Vector.unitVector(Vector.subtract(camera.vector, camera.point));
  var vpRight = Vector.unitVector(Vector.crossProduct(eyeVector, Vector.UP));
  var vpUp  = Vector.unitVector(Vector.crossProduct(vpRight, eyeVector));
  var fovRadians = Math.PI * (camera.fieldOfView / 2) /180;
  var heightWidthRatio = height / width;
  var halfWidth = Math.tan(fovRadians);
  var halfHeight = heightWidthRatio * halfWidth;
  var cameraWidth = halfWidth * 2;
  var cameraHeight = halfHeight * 2;
  var pixelWidth = cameraWidth / (width - 1);
  var pixelHeight = cameraHeight / (height -1);

  var index, color;
  var ray = {
    "point": camera.point
  };

  for (var x = 0; x < width; x++) {
    for (var y = 0; y < height; y++) {
      var xcomp = Vector.scale(vpRight, (x * pixelWidth) - halfWidth);
      var ycomp = Vector.scale(vpUp, (y * pixelHeight) - halfHeight);

      ray.vector = Vector.unitVector(Vector.add3(eyeVector, xcomp, ycomp));

      color = trace(ray, scene, 0);
      index = (x * 4) + (y * width * 4),
      data.data[index + 0] = color.x;
      data.data[index + 1] = color.y;
      data.data[index + 2] = color.z;
      data.data[index + 3] = 255;
    }
  }
  context.putImageData(data, 0 , 0);
}

// Traces the ray from the "eye" to the objects
function trace(ray, scene, depth) {
  //this is a recurisive function that could trace forever, so we stop at the 3rd reflection
  if (depth > 3)
    return;

  var distObject = intersectScene(ray, scene);
  if (distObject[0] === Infinity) {
    return Vector.WHITE;
  }

  var dist = distObject[0];
  var object = distObject[1];

  var pointAtTime = Vector.add(ray.point, Vector.scale(ray.vector, dist));

  return surface(ray, scene, object, pointAtTime, sphereNormal(object, pointAtTime), depth);
}

// takes a scenes
function intersectScene(ray, scene) {
  var closest = [Infinity, null]; //base case that it hits nothing and travels for Infinity
  for (var i = 0; i < scene.objects.length; i++) {
    var object = scene.objects[i];
    if (object.type == 'sphere') {
      var dist = sphereIntersection(object, ray);
      if (dist != undefined && dist < closest[0]) {
        closest = [dist, object];
      }
    }
    else { //it must be a floor
      var dist = floorIntersection(object, ray);
      if (dist != undefined && dist < closest[0]) {
        closest = [dist, object];
      }
    }
  }
  return closest;
}

//function for seeing how a floor intersects with this ray
function floorIntersection(floor, ray) {
  var rayPointAbove = ray.point.y > floor.point.y;
  //this checks if this ray even has a chance of intersecting
  if (rayPointAbove && (ray.vector.y >= 0) || (!rayPointAbove) && (ray.vector.y <= 0))
    return;

  var normalDotUnit = Vector.dotProduct(Vector3D(0, 1, 0), Vector.unitVector(ray.vector));
  if (normalDotUnit == 0)
    return;

  return Math.abs(Vector.dotProduct(Vector.subtract(floor.point, ray.point), Vector3D(0, 1, 0)) / normalDotUnit);
}
//function for seeing how a sphere intersects with this ray
function sphereIntersection(sphere, ray) {
  var eye_to_center = Vector.subtract(sphere.point, ray.point);
  var v = Vector.dotProduct(eye_to_center, ray.vector);
  var eoDot = Vector.dotProduct(eye_to_center, eye_to_center);
  var discriminant = (sphere.radius * sphere.radius) - eoDot + (v * v);
  if (discriminant < 0) {
    return; //returns undefined
  }
  else {
    return v - Math.sqrt(discriminant);
  }
}

function sphereNormal(sphere, pos) {
  return Vector.unitVector(Vector.subtract(pos, sphere.point));
}


function surface(ray, scene, object, pointAtTime, normal, depth) {
  var b = object.color;
  var c = Vector.ZERO;
  var lambertAmount = 0;

  if (object.type == 'floor') {
    //this algorithm allows for checkerboard pattern
    var floorX = Math.floor(pointAtTime.x / object.squareSize);
    var floorZ = Math.floor(pointAtTime.z / object.squareSize);
    if (floorX < 0) {
      floorX *= -1;
    }
    if (floorZ < 0) {
      floorZ *= -1;
    }
    if ((floorX + floorZ) % 2 == 0) {
      return object.color1;
    }
    else {
      return object.color2;
    }
  }

  //lambertShading is what shows a gradient between most 'lit' point on the object to the least 'lit'
  if (object.lambert)  { //also this is a simple way of saying if (object.lambert > 0)
    for (var i = 0; i < scene.lights.length; i++) {
      var lightPoint = scene.lights[0];
      if (!isLightVisible(pointAtTime, scene, lightPoint))
        continue;

      var contribution = Vector.dotProduct(
        Vector.unitVector(Vector.subtract(lightPoint, pointAtTime)),
        normal);
      if (contribution > 0) //sometimes lambert will be negative and we don't care about that
        lambertAmount += contribution;
    }
  }

  //Specular is a fancy word for 'reflective'
  if (object.specular) {
    var reflectedRay = {
      "point": pointAtTime,
      "vector": Vector.reflectThrough(ray.vector, normal)
    };
    var reflectedColor = trace(reflectedRay, scene, ++depth);
    if (reflectedColor) {
      c = Vector.add(c, Vector.scale(reflectedColor, object.specular));
    }
  }

  //lambert should never 'blow out' the lighting of an object
  lambertAmount = Math.min(1, lambertAmount);

  return Vector.add3(
    c,
    Vector.scale(b, lambertAmount * object.lambert),
    Vector.scale(b, object.ambient)
  );
}


//Check whether a light is visible from a surface
function isLightVisible(pt, scene, light) {
  var distObject = intersectScene({
    "point": pt,
    "vector": Vector.unitVector(Vector.subtract(pt, light))
  }, scene);
  return distObject[0] > -0.005;
}

render(scene);
