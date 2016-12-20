'use strict';

if (!Array.prototype.sample) {
    Array.prototype.sample = function sample() {
        return this[Math.floor(Math.random() * this.length)];
    };
}

// function shuffle(a) {
//     let j, x, i;
//     for (i = a.length; i; i--) {
//         j = Math.floor(Math.random() * i);
//         x = a[i - 1];
//         a[i - 1] = a[j];
//         a[j] = x;
//     }
//     return a;
// }
