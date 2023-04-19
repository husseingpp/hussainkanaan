function sin()
{
document.calcul.result.value=Math.sin(document.calcul.result.value);
}

function cos()
{
document.calcul.result.value=Math.cos(document.calcul.result.value);
}

function square()
{
document.calcul.result.value=Math.pow(document.calcul.result.value, 2);
}

function number(value)
{
document.calcul.result.value += value;
}

function remv()
{
document.calcul.result.value=" ";
}

function equal()
{
document.calcul.result.value=eval(document.calcul.result.value);
}

document.addEventListener('keydown', function(event) {
    const key = event.key;
    const isNumber = /^\d$/.test(key);
    const isOperator = /^[\+\-\*\/\(\)]$/.test(key);
    
    if (isNumber) {
      number(key);
    } else if (isOperator) {
      operator(key);
    } else if (key === 'Enter') {
      equal();
    } else if (key === 'Backspace') {
      remv();
    }
  });
  