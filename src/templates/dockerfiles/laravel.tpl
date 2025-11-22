# templates/laravel.tpl
FROM php:8.1-fpm
WORKDIR /var/www/html
RUN apt-get update && apt-get install -y git unzip libzip-dev zip && docker-php-ext-install pdo pdo_mysql
COPY --chown=www-data:www-data . .
RUN curl -sS https://getcomposer.org/installer | php -- --install-dir=/usr/local/bin --filename=composer
RUN composer install --no-dev --optimize-autoloader
EXPOSE 9000
CMD ["php-fpm"]
