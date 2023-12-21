from django.shortcuts import render

# Create your views here.
def main_view(request):
    return render(request,'main.html')

def elon_page(request):
    return render(request,'elon-musk.html')

def coffe_page(request):
    return render(request,'coffe.html')

def cal_page(request):
    return render(request,'calculator.html')