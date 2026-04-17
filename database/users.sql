-- gen_contacttype(contacttypeno, contacttypetitle)
CREATE TABLE gen_contacttype(
    contacttypeno SERIAL PRIMARY KEY, 
    contacttypetitle VARCHAR(63) NOT NULL 
);
-- INSERT INTO gen_contacttype(contacttypetitle)
-- VALUES ('Phone'), ('Mobile'), ('Email'), ('Website'), ('GitHub'), ('LinkedIn');

-- gen_peopleprimary (peopleno, peopleid, firstname, lastname, nid, age, dob, gendersetno, bloodgroup, street, postcode, country, emergencycontact, profilepicurl, validated, createdatetime, faf_parentpeopleno)
CREATE TABLE gen_peopleprimary (
    peopleno SERIAL PRIMARY KEY,
    peopleid VARCHAR(63) DEFAULT NULL,
    firstname VARCHAR(127) NOT NULL,
    lastname VARCHAR(127) DEFAULT NULL,
    tagline TEXT[], -- e.g. ["Software Engineer", "DevOps Engineer"]
    bio TEXT,
    bio_backend TEXT,
    profilepicurl VARCHAR(511) DEFAULT NULL,
    resume_url TEXT,
    resume_url_backend TEXT,
    years_of_experience INT,
    validated BOOLEAN NOT NULL DEFAULT true,
    createdatetime TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    faf_parentpeopleno INT DEFAULT NULL,
    CONSTRAINT uk_peopleprimary_peopleid UNIQUE (peopleid),
    CONSTRAINT fk_peopleprimary_faf_parentpeopleno FOREIGN KEY (faf_parentpeopleno) REFERENCES gen_peopleprimary (peopleno) ON UPDATE CASCADE
);

-- gen_peoplecontact(peopleno, contacttypeno, contactprefix, contact, isverified, usenote)
CREATE TABLE gen_peoplecontact(
    id SERIAL PRIMARY KEY,
    peopleno INT NOT NULL,
    contacttypeno INT NOT NULL,
    contactprefix VARCHAR(15) DEFAULT NULL, 
    contact VARCHAR(511) NOT NULL,
    isverified SMALLINT DEFAULT 0,
    usenote VARCHAR(255) DEFAULT NULL,
    CONSTRAINT fk_peoplecontact_peopleno FOREIGN KEY (peopleno) REFERENCES gen_peopleprimary (peopleno) ON UPDATE CASCADE,
    CONSTRAINT fk_peoplecontact_contacttypeno FOREIGN KEY (contacttypeno) REFERENCES gen_contacttype (contacttypeno) ON UPDATE CASCADE
);

-- gen_users (userno, peopleno, username, passphrase, authkey, userstatusno, ucreatedatetime, reset_pass_count, updatetime)
CREATE TABLE gen_users (
    userno SERIAL PRIMARY KEY,
    peopleno INT DEFAULT NULL,
    username VARCHAR(255) NOT NULL,
    firebase_uid VARCHAR(128) UNIQUE DEFAULT NULL,
    authkey VARCHAR(255) DEFAULT NULL,
    ucreatedatetime TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    reset_pass_count INT DEFAULT 0,
    updatetime TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uk_users_username UNIQUE (username),
    CONSTRAINT uk_users_peopleno UNIQUE (peopleno), 
    CONSTRAINT fk_users_peopleno FOREIGN KEY (peopleno) REFERENCES gen_peopleprimary (peopleno) ON UPDATE CASCADE
);
