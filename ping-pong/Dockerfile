FROM python:3.10-slim

ENV HTTP_PROXY=http://fihel1d-proxy.emea.nsn-net.net:8080
ENV HTTPS_PROXY=http://fihel1d-proxy.emea.nsn-net.net:8080
ENV NO_PROXY=localhost,127.0.0.1
ENV http_proxy=http://fihel1d-proxy.emea.nsn-net.net:8080
ENV https_proxy=http://fihel1d-proxy.emea.nsn-net.net:8080
ENV no_proxy=localhost,127.0.0.1

WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY app.py .

CMD ["python", "app.py"]
