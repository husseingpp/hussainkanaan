from django.shortcuts import render

def test_hello(request):
    return render(request, 'myapp/main.html')
