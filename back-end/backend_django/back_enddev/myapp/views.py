from django.shortcuts import render

def test_hello(request):
    return render(request, 'myapp/front-end/main.html')


